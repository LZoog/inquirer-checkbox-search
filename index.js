/**
 * `checkbox-search` type prompt
 */

var _ = require('lodash')
var util = require('util')
var chalk = require('chalk')
var cliCursor = require('cli-cursor')
var figures = require('figures')
var Base = require('./base')
var observe = require('../utils/events')
var utils = require('inquirer/lib/utils/readline')
var Paginator = require('../utils/paginator')
var Choices = require('inquirer/lib/objects/choices')

/**
 * Module exports
 */
module.exports = Prompt

/**
 * Constructor
 */
function Prompt() {
  Base.apply(this, arguments)

  if (!this.opt.source) {
    this.throwParamError('source')
  }

  this.currentChoices = []
  this.firstRender = true

  // Make sure no default is set (so it won't be printed)
  this.opt.default = null

  this.paginator = new Paginator()
}
util.inherits(Prompt, Base)

/**
 * Start the Inquiry session
 * @param  {Function} cb      Callback when prompt is done
 * @return {this}
 */
Prompt.prototype._run = function (cb) {
  this.done = cb
  const self = this
  const events = observe(this.rl)

  const validation = this.handleSubmitEvents(
    events.line.map(this.getCurrentValue.bind(this))
  )
  validation.success.forEach(this.onEnd.bind(this))
  validation.error.forEach(this.onError.bind(this))

  events.keypress.takeWhile(dontHaveAnswer).forEach(self.onKeypress.bind(this))

  function dontHaveAnswer() {
    return !self.answer
  }

  //call once at init
  self.search(null)

  return this
}


Prompt.prototype.onKeypress = function(e) {
  let len
  const keyName = (e.key && e.key.name) || undefined

  const ctrlModifier = e.key.ctrl
  const shiftModifier = e.key.shift

  if (keyName === 'down') {
    len = this.currentChoices.length
    this.selected = (this.selected < len - 1) ? this.selected + 1 : 0
    this.ensureSelectedInRange()
    this.render()
    utils.up(this.rl, 2)
  } else if (keyName === 'up') {
    len = this.currentChoices.length
    this.selected = (this.selected > 0) ? this.selected - 1 : len - 1
    this.ensureSelectedInRange()
    this.render()
  } else if (keyName === 'right') {
    if (shiftModifier) {
      this.onAllKey()
      this.render()
    } else if (ctrlModifier) {
      this.onInverseKey()
      this.render()
    } else {
      this.toggleChoice(this.selected)
      this.render()
    }
  } else {
    this.render() //render input automatically
    //Only search if input have actually changed, not because of other keypresses
    if (this.lastSearchTerm !== this.rl.line) {
      this.search(this.rl.line) //trigger new search
    }
  }
}
Prompt.prototype.search = function(searchTerm) {
  const self = this
  self.selected = 0

  //only render searching state after first time
  if (self.searchedOnce) {
    self.searching = true
    self.currentChoices = new Choices([])
    self.render() //now render current searching state
  } else {
    self.searchedOnce = true
  }

  self.lastSearchTerm = searchTerm
  const thisPromise = self.opt.source(self.answers, searchTerm)

  //store this promise for check in the callback
  self.lastPromise = thisPromise

  return thisPromise.then(function inner(choices) {
    //if another search is triggered before the current search finishes, don't set results
    if (thisPromise !== self.lastPromise) return

    choices = new Choices(choices.filter(function(choice) {
      return choice.type !== 'separator'
    }))

    self.currentChoices = choices
    self.searching = false
    self.render()
  })
}

Prompt.prototype.ensureSelectedInRange = function() {
  const selectedIndex = Math.min(this.selected, this.currentChoices.length) //not above currentChoices length - 1
  this.selected = Math.max(selectedIndex, 0) //not below 0
}

/**
 * Render the prompt to screen
 * @return {Prompt} self
 */
Prompt.prototype.render = function (error) {
  // Render question
  var message = this.getQuestion()
  var bottomContent = ''

  if (this.firstRender) {
    message += '(Type to filter, press ' + chalk.cyan.bold('<right arrow>') + ' to select, ' + chalk.cyan.bold('<shift>') + '+' + chalk.cyan.bold('<right arrow>') + ' to toggle all, ' + chalk.cyan.bold('<ctrl>') + '+' + chalk.cyan.bold('<right arrow>') + ' to inverse selection)'

    // store initial choices to be referenced with selections and new searches
    this.initialChoices = this.currentChoices
  }

  if (this.status === 'answered') {
    message += chalk.cyan(this.shortAnswer || this.answerName || this.answer)
  } else if (this.searching) {
    message += this.rl.line
    bottomContent += '  ' + chalk.dim('Searching...')
  } else if (this.currentChoices.length) {
    const choicesStr = listRender(this.initialChoices, this.currentChoices, this.selected)
    message += this.rl.line
    bottomContent += this.paginator.paginate(choicesStr, this.selected, this.opt.pageSize)
  } else {
    message += this.rl.line
    bottomContent += '  ' + chalk.yellow('No results...')
  }

  if (error) {
    bottomContent = chalk.red('>> ') + error
  }

  this.firstRender = false

  this.screen.render(message, bottomContent)
}

/**
 * When user press `enter` key
 */
Prompt.prototype.onEnd = function (state) {
  this.status = 'answered'

  // Rerender prompt (and clean subline error)
  this.render()

  this.screen.done()
  cliCursor.show()
  this.done(state.value)
}

Prompt.prototype.onError = function (state) {
  this.render(state.isValid)
}

Prompt.prototype.getCurrentValue = function () {
  const choices = this.initialChoices.filter(function (choice) {
    return Boolean(choice.checked) && !choice.disabled
  })

  this.selection = _.map(choices, 'short')
  return _.map(choices, 'value')
}


Prompt.prototype.onAllKey = function () {
  const self = this

  // return true if at least one currentChoice (from matching initialChoice) is not checked
  const shouldBeChecked = Boolean(this.currentChoices.choices.find(function (currentChoice) {
    if (currentChoice.type !== 'separator') {
      for (const initialChoice of self.initialChoices.choices) {
        if (initialChoice.name === currentChoice.name) {
          return !initialChoice.checked
        }
      }
    }
    return false
  }))

  this.currentChoices.choices.forEach(function (currentChoice) {
    if (currentChoice.type !== 'separator') {
      for (const initialChoice of self.initialChoices.choices) {
        if (initialChoice.name === currentChoice.name) {
          initialChoice.checked = shouldBeChecked
        }
      }
    }
  })
}

Prompt.prototype.onInverseKey = function () {
  var self = this

  this.currentChoices.choices.forEach(function (currentChoice) {
    if (currentChoice.type !== 'separator') {
      for (const initialChoice of self.initialChoices.choices) {

        if (currentChoice.name === initialChoice.name) {
          initialChoice.checked = !initialChoice.checked
        }
      }
    }
  })
}

Prompt.prototype.toggleChoice = function (index) {
  const currentChoice = this.currentChoices.choices[index]

  if (currentChoice !== undefined) {
    for (const initialChoice of this.initialChoices.choices) {

      if (currentChoice.name === initialChoice.name) {
        initialChoice.checked = !initialChoice.checked
      }
    }
  }
}

/**
 * Get the checkbox
 * @param  {Boolean} checked - add a X or not to the checkbox
 * @return {String} Composited checkbox string
 */
function getCheckbox(checked) {
  return checked ? chalk.green(figures.radioOn) : figures.radioOff
}

/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
function listRender(initialChoices, currentChoices, pointer) {
  let output = ''
  let separatorOffset = 0

  currentChoices.forEach(function(currentChoice, i) {
    if (currentChoice.type === 'separator') {
      separatorOffset++
      output += '  ' + currentChoice + '\n'
      return
    }

    const isSelected = (i - separatorOffset === pointer)
    output += isSelected ? chalk.cyan(figures.pointer) : ' '

    for (const initialChoice of initialChoices.choices) {
      if (currentChoice.name === initialChoice.name) {
        output += getCheckbox(initialChoice.checked) + '  ' + (initialChoice.checked ? chalk.cyan(initialChoice.name) : initialChoice.name)
      }
    }

    output += ' \n'
  })

  return output.replace(/\n$/, '')
}