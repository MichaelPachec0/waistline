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

app.Recipes = {

  list: [], //Main list of recipes
  filterList: [], //Copy of the list for filtering
  el: {}, //UI elements

  init: async function(context) {

    if (context && context.recipe)
      app.FoodsMealsRecipes.unselectOldItem(context.recipe);

    app.Recipes.getComponents();
    app.Recipes.createSearchBar();
    app.Recipes.bindUIActions();
    app.Recipes.setComponentVisibility();

    if (!app.Recipes.ready) {
      app.f7.infiniteScroll.create(app.Recipes.el.infinite); //Setup infinite list
      app.Recipes.ready = true;
    }

    app.Recipes.filterList = await app.Recipes.getListFromDB();
    app.Recipes.list = app.FoodsMealsRecipes.filterList("", undefined, app.Recipes.filterList);

    await app.Recipes.renderList(true);

    if (context)
      app.FoodsMealsRecipes.resetSearchForm(app.Recipes.el.searchForm, app.Recipes.el.searchFilter, app.Recipes.el.searchFilterIcon);
  },

  getComponents: function() {
    app.Recipes.el.scan = document.querySelector(".page[data-name='foods-meals-recipes'] #scan");
    app.Recipes.el.search = document.querySelector("#recipes-tab #recipe-search");
    app.Recipes.el.searchForm = document.querySelector("#recipes-tab #recipe-search-form");
    app.Recipes.el.searchFilter = document.querySelector("#recipes-tab #recipe-search-filter");
    app.Recipes.el.searchFilterIcon = document.querySelector("#recipes-tab #recipe-search-filter-icon");
    app.Recipes.el.searchFilterContainer = document.querySelector("#recipes-tab #recipe-search-filter-container");
    app.Recipes.el.infinite = document.querySelector(".page[data-name='foods-meals-recipes'] #recipes"); //Infinite list container
    app.Recipes.el.list = document.querySelector("#recipe-list-container ul"); //Infinite list
  },

  bindUIActions: function() {

    // Infinite list - render more items
    if (!app.Recipes.el.infinite.hasInfiniteEvent) {
      app.Recipes.el.infinite.addEventListener("infinite", (e) => {
        app.Recipes.renderList();
      });
      app.Recipes.el.infinite.hasInfiniteEvent = true;
    }

    // Search filter - reset category filter on long press
    if (!app.Recipes.el.searchFilter.hasTapholdEvent) {
      app.Recipes.el.searchFilter.addEventListener("taphold", async (e) => {
        app.FoodsMealsRecipes.clearSelectedCategories(app.Recipes.el.searchFilter, app.Recipes.el.searchFilterIcon);
        app.Recipes.list = app.FoodsMealsRecipes.filterList(app.Recipes.el.search.value, undefined, app.Recipes.filterList);
        app.Recipes.renderList(true);
      });
      app.Recipes.el.searchFilter.hasTapholdEvent = true;
    }
  },

  setComponentVisibility: function() {
    app.Recipes.el.scan.style.display = "none";

    if (app.FoodsMealsRecipes.editItems != "enabled")
      app.FoodsMealsRecipes.el.fab.style.display = "none";
    else
      app.FoodsMealsRecipes.el.fab.style.display = "block";
  },

  renderList: async function(clear) {
    if (clear) app.Utils.deleteChildNodes(app.Recipes.el.list);

    //List settings 
    let itemsPerLoad = 20; //Number of items to append at a time
    let lastIndex = document.querySelectorAll("#recipe-list-container li").length;

    let clickable = (app.FoodsMealsRecipes.editItems != "disabled");

    if (lastIndex <= app.Recipes.list.length) {
      //Render next set of items to list
      for (let i = lastIndex; i < lastIndex + itemsPerLoad; i++) {
        if (i >= app.Recipes.list.length) break; //Exit after all items in list

        let item = app.Recipes.list[i];

        item.nutrition = await app.FoodsMealsRecipes.getTotalNutrition(item.items, "subtract");
        app.FoodsMealsRecipes.renderItem(item, app.Recipes.el.list, true, false, clickable, app.Recipes.gotoEditor, app.Recipes.handleTapHold);
      }
    }
  },

  getListFromDB: function() {
    return new Promise(async function(resolve, reject) {
      let sort = app.Settings.get("foodlist", "sort");
      let list = await app.FoodsMealsRecipes.getFromDB("recipes", sort) || [];
      resolve(list);
    }).catch(err => {
      throw (err);
    });
  },

  handleTapHold: function(item, li) {
    if (item.archived === true) {
      // Offer to restore archived recipe
      app.Recipes.handleTapHoldAction("restore-item", item, li);
    } else {
      // Ask user for action
      const actions = ["archive-item", "clone-item", "clone-and-archive"];
      let options = [];

      actions.forEach((action) => {
        let choice = {
          text: app.strings.dialogs[action] || action,
          onClick: () => { app.Recipes.handleTapHoldAction(action, item, li) }
        };
        options.push(choice);
      });

      let ac = app.f7.actions.create({
        buttons: options,
        closeOnEscape: true,
        animate: !app.Settings.get("appearance", "animations")
      });
      ac.open();
    }
  },

  handleTapHoldAction: function(action, item, li) {
    let title = app.strings.dialogs[action] || action;
    let text = app.strings.dialogs.confirm || "Are you sure?";

    let div = document.createElement("div");
    div.className = "dialog-text";
    div.innerText = text;

    let dialog = app.f7.dialog.create({
      title: title,
      content: div.outerHTML,
      buttons: [{
          text: app.strings.dialogs.cancel || "Cancel",
          keyCodes: [27]
        },
        {
          text: app.strings.dialogs.yes || "Yes",
          keyCodes: [13],
          onClick: async () => {
            switch (action) {
              case "archive-item":
                await app.FoodsMealsRecipes.archiveItem(item.id, "recipe", true);
                app.Recipes.filterList = await app.Recipes.getListFromDB();
                let index = app.Recipes.list.indexOf(item);
                if (index != -1)
                  app.Recipes.list.splice(index, 1);
                li.remove();
                break;

              case "clone-item":
                await app.FoodsMealsRecipes.cloneItem(item, "recipe");
                app.Recipes.filterList = await app.Recipes.getListFromDB();
                app.Recipes.renderFilteredList();
                break;

              case "clone-and-archive":
                await app.FoodsMealsRecipes.archiveItem(item.id, "recipe", true);
                await app.FoodsMealsRecipes.cloneItem(item, "recipe");
                app.Recipes.filterList = await app.Recipes.getListFromDB();
                app.Recipes.renderFilteredList();
                break;

              case "restore-item":
                await app.FoodsMealsRecipes.archiveItem(item.id, "recipe", false);
                app.Recipes.filterList = await app.Recipes.getListFromDB();
                app.Recipes.renderFilteredList();
                break;
            }
          }
        }
      ]
    }).open();
  },

  gotoEditor: function(recipe) {
    app.data.context = {
      recipe: recipe,
      origin: "/foods-meals-recipes/",
      allNutriments: true
    };
    app.f7.views.main.router.navigate("./recipe-editor/");
  },

  renderFilteredList: function() {
    let query = app.Recipes.el.search.value;
    let categories = app.FoodsMealsRecipes.getSelectedCategories(app.Recipes.el.searchFilter);
    app.Recipes.list = app.FoodsMealsRecipes.filterList(query, categories, app.Recipes.filterList);
    app.Recipes.renderList(true);
  },

  createSearchBar: function() {
    app.FoodsMealsRecipes.initializeSearchBar(app.Recipes.el.searchForm, {
      searchbarSearch: async (searchbar, query, previousQuery) => {
        if (query == "")
          app.Recipes.filterList = await app.Recipes.getListFromDB();
        let categories = app.FoodsMealsRecipes.getSelectedCategories(app.Recipes.el.searchFilter);
        app.Recipes.list = app.FoodsMealsRecipes.filterList(query, categories, app.Recipes.filterList);
        app.Recipes.renderList(true);
      }
    });
    app.FoodsMealsRecipes.populateCategoriesField(app.Recipes.el.searchFilter, undefined, true, true, false, {
      beforeOpen: (smartSelect, prevent) => {
        smartSelect.selectEl.selectedIndex = -1;
      },
      close: (smartSelect) => {
        let query = app.Recipes.el.search.value;
        let categories = app.FoodsMealsRecipes.getSelectedCategories(app.Recipes.el.searchFilter);
        if (categories !== undefined)
          app.Recipes.el.searchFilterIcon.classList.add(".color-theme");
        else
          app.Recipes.el.searchFilterIcon.classList.remove(".color-theme");
        app.Recipes.list = app.FoodsMealsRecipes.filterList(query, categories, app.Recipes.filterList);
        app.Recipes.renderList(true);
      }
    });
  },
};

document.addEventListener("tab:init", function(e) {
  if (e.target.id == "recipes") {
    let context = app.data.context;
    app.data.context = undefined;
    app.Recipes.init(context);
  }
});