/*
  Copyright 2020, 2021 David Healey

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with app.  If not, see <http://www.gnu.org/licenses/>.
*/

app.Diary = {

  ready: false,
  calendar: undefined,
  el: {},
  groups: [],

  init: async function(context) {

    this.getComponents();
    this.bindUIActions();

    app.Diary.calendar = this.createCalendar(); //Setup calendar
    this.bindCalendarControls();

    //If items have been passed, add them to the db
    if (context) {

      if (context.items || context.item) {

        if (context.items)
          await this.addItems(context.items, context.category);
        else
          await this.updateItem(context.item);

        app.Diary.ready = false; //Trigger fresh render
      }
    }

    if (!app.Diary.ready) {
      app.Diary.groups = this.createMealGroups(); //Create meal groups
      this.render();
      app.Diary.ready = true;
    }
  },

  getComponents: function() {
    app.Diary.el.logWeight = document.querySelector(".page[data-name='diary'] #log-weight");
  },

  bindUIActions: function() {
    if (!app.Diary.el.logWeight.hasClickEvent) {
      app.Diary.el.logWeight.addEventListener("click", (e) => {
        app.Diary.logWeight();
      });
      app.Diary.el.logWeight.hasClickEvent = true;
    }
  },

  setReadyState: function(state) {
    if (state) {
      app.Diary.ready = state;
    }
  },

  createCalendar: function() {
    let result = app.f7.calendar.create({
      inputEl: "#diary-date",
      openIn: "customModal",
      on: {
        init: function(c) {
          if (app.Diary.date)
            c.setValue([app.Diary.date]);
          else {
            let now = new Date();
            let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            c.setValue([today]);
            app.Diary.date = c.getValue();
          }
        },
        change: function(c) {
          app.Diary.date = c.getValue();
          if (app.Diary.ready)
            app.Diary.render();
          c.close();
        }
      }
    });

    return result;
  },

  bindCalendarControls: function() {
    //Bind actions for previous/next buttons
    const buttons = document.getElementsByClassName("change-date");
    Array.from(buttons).forEach((x, i) => {

      if (!x.hasClickEvent) {
        x.addEventListener("click", (e) => {
          let date = new Date(app.Diary.calendar.getValue());
          i == 0 ? date.setDate(date.getDate() - 1) : date.setDate(date.getDate() + 1);
          app.Diary.calendar.setValue([date]);
        });
        x.hasClickEvent = true;
      }
    });
  },

  resetDate: function() {
    let now = new Date();
    let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    app.Diary.date = today;
  },

  render: async function() {

    let entry = await this.getEntryFromDB(); // Get diary entry from DB
    let totalNutrition;

    //Clear groups
    for (let i = 0; i < app.Diary.groups.length; i++)
      app.Diary.groups[i].reset();

    // Populate groups and get overal nutrition
    if (entry) {
      await this.populateGroups(entry);
      totalNutrition = await app.FoodsMealsRecipes.getTotalNutrition(entry.items);
    }

    // Render category groups
    let container = document.getElementById("diary-day");
    container.innerHTML = "";

    app.Diary.groups.forEach((x) => {
      x.render(container);
    });

    // Render nutrition swiper card
    let swiper = app.f7.swiper.get('#diary-nutrition .swiper-container');
    let swiperWrapper = document.querySelector('#diary-nutrition .swiper-wrapper');
    swiperWrapper.innerHTML = "";

    await app.Diary.renderNutritionCard(totalNutrition, new Date(app.Diary.date), swiper);
  },

  renderNutritionCard: function(nutrition, date, swiper) {

    let nutriments = app.nutriments;
    let nutrimentShortNames = app.nutrimentShortNames;
    let nutrimentUnits = app.nutrimentUnits;
    let energyUnit = app.Settings.get("nutrition", "energy-unit");
    let rows = [];
    let count = 0;

    // Optimize column count for screen width
    let columnsToShow = 4;

    if (window.innerWidth > 500)
      columnsToShow = 5;

    if (window.innerWidth < 400)
      columnsToShow--;

    if (app.Settings.get("diary", "show-nutrition-units"))
      columnsToShow--;

    for (i = 0; i < nutriments.length; i++) {

      let x = nutriments[i];

      if (!app.Goals.showInDiary(x)) continue;

      let goal = app.Goals.get(x, date);

      if (((x == "kilojoules" && energyUnit == "kj") || x != "kilojoules")) {

        // Show n nutriments at a time 
        if (count % columnsToShow == 0) {
          let slide = document.createElement("div");
          slide.className = "swiper-slide";
          swiper.appendSlide(slide);

          rows[0] = document.createElement("div");
          rows[0].className = "row nutrition-total-values";
          slide.appendChild(rows[0]);

          rows[1] = document.createElement("div");
          rows[1].className = "row nutrition-total-title";
          slide.appendChild(rows[1]);
        }

        // Values and goal text
        let values = document.createElement("div");
        values.className = "col";
        values.id = x + "-value";

        let span = document.createElement("span");
        let t = document.createTextNode("");

        if (nutrition && nutrition[x] !== undefined) {

          if (x !== "calories" && x !== "kilojoules")
            t.nodeValue = parseFloat(nutrition[x].toFixed(2));
          else {
            let energy = parseInt(nutrition[x]);

            if (x == "calories" && energyUnit == "kJ")
              energy = Math.round(energy * 4.1868);

            t.nodeValue = parseInt(energy);
          }
        } else
          t.nodeValue = "0";

        // Set value text colour
        if (goal !== undefined && goal !== "") {
          if (parseFloat(t.nodeValue) > goal)
            span.style.color = "red";
          else
            span.style.color = "green";

          t.nodeValue += " / " + goal + " ";
        }

        // Unit
        if (app.Settings.get("diary", "show-nutrition-units")) {
          let unit = nutrimentUnits[x];
          if (unit !== undefined)
            t.nodeValue += unit;
        }

        span.appendChild(t);
        values.appendChild(span);
        rows[0].appendChild(values);

        // Title
        let title = document.createElement("div");
        title.className = "col";
        title.id = x + "-title";

        let text = nutrimentShortNames[i];
        t = document.createTextNode((text.charAt(0).toUpperCase() + text.slice(1)).replace("-", " "));
        title.appendChild(t);
        rows[1].appendChild(title);

        count++;
      }
    }
  },

  createMealGroups: function() {
    const mealNames = app.Settings.get("diary", "meal-names");
    let groups = [];

    if (mealNames !== undefined) {
      mealNames.forEach((x, i) => {
        if (x != "") {
          let g = app.Group.create(x, i);
          groups.push(g);
        }
      });
    }

    return groups;
  },

  getEntryFromDB: function() {
    return new Promise(async function(resolve, reject) {
      if (app.Diary.date !== undefined) {
        let entry = await dbHandler.get("diary", "dateTime", new Date(app.Diary.date));
        resolve(entry);
      }
    }).catch(err => {
      throw (err);
    });
  },

  getNewEntry: function() {
    let entry = {
      dateTime: new Date(app.Diary.date),
      items: [],
      stats: {},
    };
    return entry;
  },

  populateGroups: function(entry) {
    return new Promise(async function(resolve, reject) {
      entry.items.forEach(async (x, i) => {
        x.index = i; // Index in array, not stored in DB
        app.Diary.groups[x.category].addItem(x);
      });

      resolve();
    }).catch(err => {
      throw (err);
    });
  },

  addItems: function(items, category) {
    return new Promise(async function(resolve, reject) {
      // Get current entry or create a new one
      let entry = await app.Diary.getEntryFromDB() || app.Diary.getNewEntry();

      items.forEach((x) => {
        let item = x;
        item.dateTime = new Date();
        item.category = category;
        item.quantity = x.quantity || 1;
        entry.items.push(item);
      });

      await dbHandler.put(entry, "diary");

      resolve();
    }).catch(err => {
      throw (err);
    });
  },

  updateItem: function(item) {
    return new Promise(async function(resolve, reject) {
      let entry = await app.Diary.getEntryFromDB();

      if (entry) {
        entry.items.splice(item.index, 1, item);
        delete item.index; // Array index is not stored in the db

        dbHandler.put(entry, "diary").onsuccess = function() {
          resolve();
        };
      } else {
        resolve();
      }
    }).catch(err => {
      throw (err);
    });
  },

  deleteItem: function(item) {
    let title = app.strings["confirm-delete-title"] || "Delete";
    let text = app.strings["confirm-delete"] || "Are you sure?";

    let dialog = app.f7.dialog.confirm(text, title, async () => {

      let entry = await app.Diary.getEntryFromDB();

      if (entry !== undefined)
        entry.items.splice(item.index, 1);

      dbHandler.put(entry, "diary").onsuccess = function(e) {
        app.f7.views.main.router.refreshPage();
      };
    });
  },

  quickAdd: function(category) {
    let title = app.strings["quick-add"] || "Quick Add";
    let text = app.strings["calories"] || "Calories";

    let dialog = app.f7.dialog.prompt(text, title, async function(value) {
      let entry = await app.Diary.getEntryFromDB() || app.Diary.getNewEntry();

      let quantity = value;

      if (!isNaN(quantity)) {
        let item = await app.Foodlist.getQuickAddItem(); // Get food item

        if (item !== undefined) {
          item.dateTime = new Date();
          item.category = category;
          item.quantity = parseInt(quantity);

          entry.items.push(item);

          dbHandler.put(entry, "diary").onsuccess = function(e) {
            app.f7.views.main.router.refreshPage();
          };
        }
      }
    });
  },

  logWeight: function() {
    let title = app.strings["record-weight"] || "Record Weight";
    let text = app.strings["weight"] || "Weight";
    let lastWeight = window.localStorage.getItem("weight") || 0;
    let dialog = app.f7.dialog.prompt(text, title, this.setWeight, null, lastWeight);
  },

  setWeight: async function(value) {
    let entry = await app.Diary.getEntryFromDB() || app.Diary.getNewEntry();

    entry.stats.weight = {
      value: value,
      unit: "kg"
    };

    dbHandler.put(entry, "diary").onsuccess = function(e) {
      window.localStorage.setItem("weight", value);
      app.Utils.toast("Saved");
    };
  },

  gotoFoodlist: function(category) {
    app.f7.views.main.router.navigate("/foods-meals-recipes/", {
      "context": {
        origin: "/diary/",
        category: category,
        date: new Date(app.Diary.calendar.getValue())
      }
    });
  },
};

document.addEventListener("page:init", function(event) {
  if (event.target.matches(".page[data-name='diary']")) {
    let context = app.f7.data.context;
    app.f7.data.context = undefined;
    app.Diary.init(context);
  }
});

document.addEventListener("page:reinit", function(event) {
  if (event.target.matches(".page[data-name='diary']")) {
    let context = app.f7.data.context;
    app.f7.data.context = undefined;
    app.Diary.init(context);
  }
});