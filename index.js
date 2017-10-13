/**
 * `list` type prompt
 */

var _ = require('lodash');
var util = require('util');
var chalk = require('chalk');
var cliCursor = require('cli-cursor');
var figures = require('figures');
var Base = require('./base');
var observe = require('../utils/events');
var utils = require('inquirer/lib/utils/readline');
var Paginator = require('../utils/paginator');
var Choices = require('inquirer/lib/objects/choices');

/**
 * Module exports
 */

module.exports = Prompt;

/**
 * Constructor
 */

function Prompt() {
  Base.apply(this, arguments);

  if (!this.opt.source) {
    this.throwParamError('source');
  }

  // if (_.isArray(this.opt.default)) {
  //   this.opt.choices.forEach(function (choice) {
  //     if (this.opt.default.indexOf(choice.value) >= 0) {
  //       choice.checked = true;
  //     }
  //   }, this);
  // }

  this.currentChoices = [];

  this.pointer = 0;
  this.firstRender = true;

  // Make sure no default is set (so it won't be printed)
  this.opt.default = null;

  this.paginator = new Paginator();
}
util.inherits(Prompt, Base);

/**
 * Start the Inquiry session
 * @param  {Function} cb      Callback when prompt is done
 * @return {this}
 */

Prompt.prototype._run = function (cb) {
  this.done = cb;

  var self = this;

  var events = observe(this.rl);

  var validation = this.handleSubmitEvents(
    events.line.map(this.getCurrentValue.bind(this))
  );
  validation.success.forEach(this.onEnd.bind(this));
  validation.error.forEach(this.onError.bind(this));

  // events.normalizedUpKey.takeUntil(validation.success).forEach(this.onUpKey.bind(this));
  // events.normalizedDownKey.takeUntil(validation.success).forEach(this.onDownKey.bind(this));
  // events.numberKey.takeUntil(validation.success).forEach(this.onNumberKey.bind(this));
  // events.spaceKey.takeUntil(validation.success).forEach(this.onSpaceKey.bind(this));
  // events.aKey.takeUntil(validation.success).forEach(this.onAllKey.bind(this));
  // events.iKey.takeUntil(validation.success).forEach(this.onInverseKey.bind(this));

  events.keypress.takeWhile(dontHaveAnswer).forEach(self.onKeypress.bind(this));

  function dontHaveAnswer() {
    return !self.answer;
  }

  //call once at init
  self.search(null);

  // store initial choices in object to be referenced with new searches
  this.lastPromise.then(function(choices) {
    // self.initialChoices = new Choices([]);

    // for (var i = 0; i < choices.length; i++) {
    //   self.initialChoices[choices[i]] = {};
    //   self.initialChoices[choices[i]].checked = false;
    // }

    choices = new Choices(choices.filter(function(choice) {
      return choice.type !== 'separator';
    }));

    self.initialChoices = choices;

  })

  // Init the prompt
  // cliCursor.hide();
  // this.render();

  return this;
};


Prompt.prototype.onKeypress = function(e) {
  var len;
  var keyName = (e.key && e.key.name) || undefined;

  // console.log('onKeypress this.initialChoices',this.initialChoices);

  // this.lastPromise.then(function(result) {
  //   console.log('result', result);
  // })

  var ctrlModifier = e.key.ctrl;

  if (keyName === 'tab' && this.opt.suggestOnly) {
    // if (this.currentChoices.getChoice(this.selected)) {
    //   this.rl.write(ansiEscapes.cursorLeft);
    //   var autoCompleted = this.currentChoices.getChoice(this.selected).value;
    //   this.rl.write(ansiEscapes.cursorForward(autoCompleted.length));
    //   this.rl.line = autoCompleted
    //   this.render();
    // }
  } else if (keyName === 'down') {
    len = this.currentChoices.length;

    this.selected = (this.selected < len - 1) ? this.selected + 1 : 0;
    this.ensureSelectedInRange();
    this.render();
    utils.up(this.rl, 2);
  } else if (keyName === 'up') {
    len = this.currentChoices.length;
    this.selected = (this.selected > 0) ? this.selected - 1 : len - 1;
    this.ensureSelectedInRange();
    this.render();
  } else if (keyName === 'right') {
    this.toggleChoice(this.selected);
    this.render();
  } else {
    // this.render(); //render input automatically
    //Only search if input have actually changed, not because of other keypresses
    if (this.lastSearchTerm !== this.rl.line) {
      this.search(this.rl.line); //trigger new search
    }
  }
};
Prompt.prototype.search = function(searchTerm) {
  var self = this;
  self.selected = 0;

  //only render searching state after first time
  if (self.searchedOnce) {
    self.searching = true;
    self.currentChoices = new Choices([]);
    self.render(); //now render current searching state
  } else {
    self.searchedOnce = true;
  }

  self.lastSearchTerm = searchTerm;
  var thisPromise = self.opt.source(self.answers, searchTerm);

  //store this promise for check in the callback
  self.lastPromise = thisPromise;

  return thisPromise.then(function inner(choices) {
    //if another search is triggered before the current search finishes, don't set results
    if (thisPromise !== self.lastPromise) return;

    choices = new Choices(choices.filter(function(choice) {
      return choice.type !== 'separator';
    }));

    self.currentChoices = choices;
    self.searching = false;
    self.render();
  });
};
Prompt.prototype.ensureSelectedInRange = function() {
  var selectedIndex = Math.min(this.selected, this.currentChoices.length); //not above currentChoices length - 1
  this.selected = Math.max(selectedIndex, 0); //not below 0
}

/**
 * Render the prompt to screen
 * @return {Prompt} self
 */

Prompt.prototype.render = function (error) {
  // Render question
  var message = this.getQuestion();
  var bottomContent = '';

  if (this.firstRender) {
    message += '(Type to filter, press ' + chalk.cyan.bold('<right arrow>') + ' to select, ' + chalk.cyan.bold('<ctrl>') + '+' + chalk.cyan.bold('<a>') + ' to toggle all, ' + chalk.cyan.bold('<ctrl>') + '+' + chalk.cyan.bold('<i>') + ' to inverse selection)';
  }

  // Render choices or answer depending on the state
  // if (this.status === 'answered') {
  //   message += chalk.cyan(this.selection.join(', '));
  // } else {
  //   var choicesStr = renderChoices(this.opt.choices, this.pointer);
  //   var indexPosition = this.opt.choices.indexOf(this.opt.choices.getChoice(this.pointer));
  //   message += '\n' + this.paginator.paginate(choicesStr, indexPosition, this.opt.pageSize);
  // }

  if (this.status === 'answered') {
    message += chalk.cyan(this.shortAnswer || this.answerName || this.answer);
  } else if (this.searching) {
    message += this.rl.line;
    bottomContent += '  ' + chalk.dim('Searching...');
  } else if (this.currentChoices.length) {
    var choicesStr = listRender(this.currentChoices, this.selected);
    message += this.rl.line;
    bottomContent += this.paginator.paginate(choicesStr, this.selected, this.opt.pageSize);
  } else {
    message += this.rl.line;
    bottomContent += '  ' + chalk.yellow('No results...');
  }

  if (error) {
    bottomContent = chalk.red('>> ') + error;
  }

  this.firstRender = false;

  this.screen.render(message, bottomContent);
};

/**
 * When user press `enter` key
 */

Prompt.prototype.onEnd = function (state) {
  this.status = 'answered';

  // Rerender prompt (and clean subline error)
  this.render();

  this.screen.done();
  cliCursor.show();
  this.done(state.value);
};

Prompt.prototype.onError = function (state) {
  this.render(state.isValid);
};

Prompt.prototype.getCurrentValue = function () {

  var choices = this.initialChoices.filter(function (choice) {
    return Boolean(choice.checked) && !choice.disabled;
  });

  this.selection = _.map(choices, 'short');
  return _.map(choices, 'value');
};

// Prompt.prototype.onUpKey = function () {
//   var len = this.opt.choices.realLength;
//   this.pointer = (this.pointer > 0) ? this.pointer - 1 : len - 1;
//   this.render();
// };

// Prompt.prototype.onDownKey = function () {
//   var len = this.opt.choices.realLength;
//   this.pointer = (this.pointer < len - 1) ? this.pointer + 1 : 0;
//   this.render();
// };

// Prompt.prototype.onNumberKey = function (input) {
//   if (input <= this.opt.choices.realLength) {
//     this.pointer = input - 1;
//     this.toggleChoice(this.pointer);
//   }
//   this.render();
// };

Prompt.prototype.onSpaceKey = function () {
  this.toggleChoice(this.pointer);
  this.render();
};

Prompt.prototype.onAllKey = function () {
  var shouldBeChecked = Boolean(this.opt.choices.find(function (choice) {
    return choice.type !== 'separator' && !choice.checked;
  }));

  this.opt.choices.forEach(function (choice) {
    if (choice.type !== 'separator') {
      choice.checked = shouldBeChecked;
    }
  });

  this.render();
};

Prompt.prototype.onInverseKey = function () {
  this.opt.choices.forEach(function (choice) {
    if (choice.type !== 'separator') {
      choice.checked = !choice.checked;
    }
  });

  this.render();
};

Prompt.prototype.toggleChoice = function (index) {
  var item = this.currentChoices.choices[index];
  if (item !== undefined) {
    this.currentChoices.choices[index].checked = !item.checked;

    for (const choice of this.initialChoices.choices) {
      if (choice.name === item.name) {
        choice.checked = item.checked;
      }
    }
  }

};

/**
 * Function for rendering checkbox choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */

function renderChoices(choices, pointer) {
  var output = '';
  var separatorOffset = 0;

  choices.forEach(function (choice, i) {
    if (choice.type === 'separator') {
      separatorOffset++;
      output += ' ' + choice + '\n';
      return;
    }

    if (choice.disabled) {
      separatorOffset++;
      output += ' - ' + choice.name;
      output += ' (' + (_.isString(choice.disabled) ? choice.disabled : 'Disabled') + ')';
    } else {
      var isSelected = (i - separatorOffset === pointer);
      output += isSelected ? chalk.cyan(figures.pointer) : ' ';
      output += getCheckbox(choice.checked) + ' ' + choice.name;
    }

    output += '\n';
  });

  return output.replace(/\n$/, '');
}

/**
 * Get the checkbox
 * @param  {Boolean} checked - add a X or not to the checkbox
 * @return {String} Composited checkbox string
 */

function getCheckbox(checked) {
  return checked ? chalk.green(figures.radioOn) : figures.radioOff;
}



/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
function listRender(choices, pointer) {
  var output = '';
  var separatorOffset = 0;

  choices.forEach(function(choice, i) {
    if (choice.type === 'separator') {
      separatorOffset++;
      output += '  ' + choice + '\n';
      return;
    }

    var isSelected = (i - separatorOffset === pointer);
    output += isSelected ? chalk.cyan(figures.pointer) : ' ';

    output += getCheckbox(choice.checked) + '  ' + (choice.checked ? chalk.cyan(choice.name) : choice.name);

    output += ' \n';
  });

  return output.replace(/\n$/, '');
}
