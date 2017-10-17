const inquirer = require('inquirer')

inquirer.registerPrompt('checkbox-search', require('./index'))

const states = [
  'Alabama',
  'Alaska',
  'American Samoa',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District Of Columbia',
  'Federated States Of Micronesia',
  'Florida',
  'Georgia',
  'Guam',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Marshall Islands',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Northern Mariana Islands',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Palau',
  'Pennsylvania',
  'Puerto Rico',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virgin Islands',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming'
]

function filterStates(answers, input) {
  input = input || ''
  const inputArray = input.split(' ')

  return new Promise((resolve) => {
    resolve(states.filter((state) => {
      let shouldInclude = true

      inputArray.forEach((inputChunk) => {
        // if any term to filter by doesn't exist, exclude
        if (!state.toLowerCase().includes(inputChunk.toLowerCase())) {
          shouldInclude = false
        }
      })

      return shouldInclude
    }))
  })
}

inquirer.prompt([{
  type: 'checkbox-search',
  name: 'states',
  message: 'Which states would you like to visit?',
  source: filterStates
}]).then(answers => {
  console.log(JSON.stringify(answers.states, null, 2))
})