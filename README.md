# inquirer-checkbox-search

This is a prompt with user input search functionality made for [inquirer](https://github.com/SBoudrias/Inquirer.js).

Inspired by the checkbox prompt included in the inquirer core and [inquirer-autocomplete-prompt](https://github.com/mokkabonna/inquirer-autocomplete-prompt).

**Note:** At the time of writing, this prompt has not been thoroughly vetted and tested, but currently serves the purpose it was originally written for. Contributions welcome.

## Installation

```
npm install --save inquirer-checkbox-search
```

## Usage

This prompt is anonymous, meaning you can register this prompt with the type name you please:

```javascript
inquirer.registerPrompt('checkbox-search', require('inquirer-checkbox-search'));
inquirer.prompt({
  type: 'checkbox-search',
  ...
})
```

Change `checkbox-search` to whatever you prefer.

### Options

This prompt is essentially a hybrid between [inquirer checkbox](https://github.com/SBoudrias/Inquirer.js#checkbox---type-checkbox) and [inquirer-autocomplete-prompt](https://github.com/mokkabonna/inquirer-autocomplete-prompt). See each Readme for available options, excluding **suggestOnly**.

### Example

```javascript
inquirer.registerPrompt('checkbox-search', require('inquirer-checkbox-search'))
inquirer.prompt([{
  type: 'checkbox-search',
  name: 'states',
  message: 'Which states would you like to visit?',
  source: (answersSoFar, input) => {
    return myApi.searchStates(input)
  }
}]).then(answers => {
  // etc
})
```

See [example.js](https://github.com/lzoog/inquirer-checkbox-search/blob/master/example.js) for a working example.

### Keybindings
Use the `up`/`down` arrows to navigate the current list. Begin typing to filter the list results. The items selected in the filtered list persist through all searches.

Use the `right arrow` to make a selection. Use `shift`+`right arrow` to select all items or `control`+`right arrow` to inverse all items in either the original or filtered search list. Press `enter` when finished with your selection.