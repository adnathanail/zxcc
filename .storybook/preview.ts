import '../src/index'

export default {
  parameters: {
    options: {
      storySort: {
        order: [
          'Playground',
          'Graphs',
          ['Basic', 'Algebraic', 'Advanced', 'Interactions'],
          'Hypergraphs',
          ['Basic', 'Direct input', 'Interactions'],
          'Other',
          ['Elements', 'Both viewers', 'Tests']
        ],
      },
    },
  },
}
