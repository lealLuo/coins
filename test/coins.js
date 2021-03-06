let test = require('tape')
let coins = require('..')

function getHandler (handlers) {
  return (...args) => {
    handlers.forEach((f) => f(...args))
  }
}

test('initializer', (t) => {
  t.test('no options', (t) => {
    let c = coins()
    let initializer = getHandler(c.initializers)

    let state = {}
    initializer(state, {})

    t.deepEquals(state.accounts, {})
    t.deepEquals(state.fee, {})

    t.end()
  })

  t.test('with initialBalances', (t) => {
    let c = coins({
      initialBalances: {
        'foo': 123
      }
    })
    let initializer = getHandler(c.initializers)

    let state = {}
    initializer(state, {})

    t.deepEquals(state.accounts, { foo: { sequence: 0, balance: 123 } })
    t.deepEquals(state.fee, {})

    t.end()
  })

  t.test('with handler that has initialState', (t) => {
    let c = coins({
      handlers: {
        foo: {
          initialState: { bar: 'baz' }
        }
      }
    })
    let initializer = getHandler(c.initializers)

    let state = {}
    initializer(state, {})

    t.deepEquals(state.foo, { bar: 'baz' })
    t.deepEquals(state.accounts, {})
    t.deepEquals(state.fee, {})

    t.end()
  })

  t.test('with handler that has initializer', (t) => {
    let state = {}
    let context = {}
    let opts = {
      handlers: {
        foo: {
          initialize: (state2, context2, opts2) => {
            t.equals(state2, state.foo)
            t.true('mint' in context2)
            t.true('burn' in context2)
            t.true('getAccount' in context2)
            t.equals(opts2, opts)
            state2.bar = 'baz'
          }
        }
      }
    }
    let c = coins(opts)
    let initializer = getHandler(c.initializers)

    initializer(state, context)

    t.deepEquals(state.foo, { bar: 'baz' })
    t.deepEquals(state.accounts, {})
    t.deepEquals(state.fee, {})

    t.end()
  })

  t.test('with handler that has both initialState and initializer', (t) => {
    let state = {}
    let context = {}
    let opts = {
      handlers: {
        foo: {
          initialState: { bar: 123 },
          initialize: (state2, context2, opts2) => {
            t.equals(state2.bar, 123)
            t.equals(state2, state.foo)
            t.true('mint' in context2)
            t.true('burn' in context2)
            t.true('getAccount' in context2)
            t.equals(opts2, opts)
            state2.bar = 'baz'
          }
        }
      }
    }
    let c = coins(opts)
    let initializer = getHandler(c.initializers)

    initializer(state, context)

    t.deepEquals(state.foo, { bar: 'baz' })
    t.deepEquals(state.accounts, {})
    t.deepEquals(state.fee, {})

    t.end()
  })

  t.end()
})

test('tx handler', (t) => {
  t.test('missing from', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, {}, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Not a valid coins transaction, must have "to" and "from"')
    }

    t.end()
  })

  t.test('missing to', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, { from: [] }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Not a valid coins transaction, must have "to" and "from"')
    }

    t.end()
  })

  t.test('with no inputs or outputs', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, { from: [], to: [] }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Must have at least 1 input')
    }

    t.end()
  })

  t.test('with invalid input amount', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, {
        from: [ { amount: 'abc' } ],
        to: [ {} ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Inputs and outputs must have a number `amount`')
    }

    t.end()
  })

  t.test('with negative input amount', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, {
        from: [ { amount: -100 } ],
        to: [ {} ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Amount must be >= 0')
    }

    t.end()
  })

  t.test('with floating-point input amount', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, {
        from: [ { amount: 100.5 } ],
        to: [ {} ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Amount must be an integer')
    }

    t.end()
  })

  t.test('with oversized input amount', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    let state = {}
    try {
      txHandler(state, {
        from: [ { amount: 2 ** 60 } ],
        to: [ {} ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Amount must be < 2^53')
    }

    t.end()
  })

  t.test('mismatched amounts', (t) => {
    let c = coins({
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    try {
      txHandler({}, {
        from: [
          { type: 'foo', amount: 100 }
        ],
        to: [
          { type: 'foo', amount: 101 }
        ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Sum of inputs and outputs must match')
    }

    t.end()
  })

  t.test('amount sum overflow', (t) => {
    let c = coins({
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    try {
      txHandler({}, {
        from: [
          { type: 'foo', amount: 2 ** 52 },
          { type: 'foo', amount: 2 ** 52 },
          { type: 'foo', amount: 2 ** 52 }
        ],
        to: [
          { type: 'foo', amount: 2 ** 52 },
          { type: 'foo', amount: 2 ** 52 },
          { type: 'foo', amount: 2 ** 52 }
        ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Amount overflow')
    }

    t.end()
  })

  t.test('missing handler', (t) => {
    let c = coins()
    let txHandler = getHandler(c.transactionHandlers)

    try {
      txHandler({}, {
        from: [
          { type: 'foo', amount: 100 }
        ],
        to: [
          { type: 'foo', amount: 100 }
        ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Unknown handler type: "foo"')
    }

    t.end()
  })

  t.test('missing handler onInput', (t) => {
    let c = coins({
      handlers: {
        foo: {
          onOutput () {}
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    try {
      txHandler({}, {
        from: [
          { type: 'foo', amount: 100 }
        ],
        to: [
          { type: 'foo', amount: 100 }
        ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Handler "foo" does not implement "onInput"')
    }

    t.end()
  })

  t.test('missing handler onOutput', (t) => {
    let c = coins({
      handlers: {
        foo: {
          onInput () {}
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    try {
      txHandler({}, {
        from: [
          { type: 'foo', amount: 100 }
        ],
        to: [
          { type: 'foo', amount: 100 }
        ]
      }, {})
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Handler "foo" does not implement "onOutput"')
    }

    t.end()
  })

  t.test('basic', (t) => {
    t.plan(10)
    let state = {}
    let tx = {
      from: [
        { type: 'foo', abc: 123, amount: 100 }
      ],
      to: [
        { type: 'foo', def: 456, amount: 100 }
      ]
    }
    let c = coins({
      handlers: {
        foo: {
          onInput (input, state2, context) {
            t.deepEquals(input, { type: 'foo', abc: 123, amount: 100 })
            t.equals(state2, state.foo)
            t.deepEquals(context.transaction, tx)
            t.ok(context.sigHash)
            t.equals(context.lol, 4)
          },
          onOutput (output, state2, context) {
            t.deepEquals(output, { type: 'foo', def: 456, amount: 100 })
            t.equals(state2, state.foo)
            t.deepEquals(context.transaction, tx)
            t.ok(context.sigHash)
            t.equals(context.lol, 4)
          }
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    txHandler(state, tx, { lol: 4 })
  })

  t.test('with non-array from/to', (t) => {
    t.plan(10)
    let state = {}
    let tx = {
      from: { type: 'foo', abc: 123, amount: 100 },
      to: { type: 'foo', def: 456, amount: 100 }
    }
    let c = coins({
      handlers: {
        foo: {
          onInput (input, state2, context) {
            t.deepEquals(input, { type: 'foo', abc: 123, amount: 100 })
            t.equals(state2, state.foo)
            t.deepEquals(context.transaction, tx)
            t.ok(context.sigHash)
            t.equals(context.lol, 4)
          },
          onOutput (output, state2, context) {
            t.deepEquals(output, { type: 'foo', def: 456, amount: 100 })
            t.equals(state2, state.foo)
            t.deepEquals(context.transaction, tx)
            t.ok(context.sigHash)
            t.equals(context.lol, 4)
          }
        }
      }
    })
    let txHandler = getHandler(c.transactionHandlers)

    txHandler(state, tx, { lol: 4 })
  })

  t.end()
})

test('block handler', (t) => {
  t.test('default', (t) => {
    let c = coins()
    let blockHandler = getHandler(c.blockHandlers)
    blockHandler({}, {})
    t.pass()
    t.end()
  })

  t.test('handler', (t) => {
    t.plan(4)
    let state = { foo: {} }
    let context = {}
    let c = coins({
      handlers: {
        foo: {
          onBlock (state2, context2) {
            t.equals(state2, state.foo)
            t.true('mint' in context2)
            t.true('burn' in context2)
            t.true('getAccount' in context2)
          }
        }
      }
    })
    let blockHandler = getHandler(c.blockHandlers)
    blockHandler(state, context)
  })

  t.end()
})

test('minFee option', (t) => {
  t.test('no fee', (t) => {
    let c = coins({
      minFee: 123,
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let state = {}
    let transactionHandler = getHandler(c.transactionHandlers)
    try {
      transactionHandler(state, {
        from: { type: 'foo', amount: 100 },
        to: { type: 'foo', amount: 100 }
      })
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Must pay fee')
    }
    t.end()
  })

  t.test('less than minimum', (t) => {
    let c = coins({
      minFee: 123,
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let state = {}
    let transactionHandler = getHandler(c.transactionHandlers)
    try {
      transactionHandler(state, {
        from: { type: 'foo', amount: 100 },
        to: { type: 'fee', amount: 100 }
      })
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Must pay fee of at least 123')
    }
    t.end()
  })

  t.test('not last output', (t) => {
    let c = coins({
      minFee: 100,
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let state = {}
    let transactionHandler = getHandler(c.transactionHandlers)
    try {
      transactionHandler(state, {
        from: { type: 'foo', abc: 123, amount: 200 },
        to: [
          { type: 'fee', amount: 100 },
          { type: 'foo', amount: 100 }
        ]
      })
      t.fail()
    } catch (err) {
      t.equals(err.message, 'Must pay fee')
    }
    t.end()
  })

  t.test('sufficient fee', (t) => {
    let c = coins({
      minFee: 100,
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let state = {}
    let transactionHandler = getHandler(c.transactionHandlers)
    transactionHandler(state, {
      from: { type: 'foo', abc: 123, amount: 200 },
      to: [
        { type: 'foo', amount: 100 },
        { type: 'fee', amount: 100 }
      ]
    })
    t.pass()
    t.end()
  })

  t.test('sufficient fee (single)', (t) => {
    let c = coins({
      minFee: 100,
      handlers: {
        foo: {
          onInput () {},
          onOutput () {}
        }
      }
    })
    let state = {}
    let transactionHandler = getHandler(c.transactionHandlers)
    transactionHandler(state, {
      from: { type: 'foo', abc: 123, amount: 100 },
      to: { type: 'fee', def: 456, amount: 100 }
    })
    t.pass()
    t.end()
  })

  t.end()
})
