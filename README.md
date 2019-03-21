# Coins

`coins` is a cryptocurrency middleware for [Lotion](https://github.com/keppel/lotion).

It gives you a fully-functional token out-of-the-box, but can also act as a framework for more complex functionality (e.g. smart contracts). ERC20 tokens are so 2017!

## Installation

`coins` requires __node v7.6.0__ or higher.

```bash
$ npm install coins
```

## Usage

### Basic coin usage

First, generate an address for yourself:
```bash
$ npx coins
Your Address:
338sjLktF4XzRfz25oyH11jVYhZMokbsr

Your wallet seed is stored at "~/.coins",
make sure to keep it secret!
```

Add the middleware to your lotion app, and be sure to give yourself some coins!

`app.js`
```js
let lotion = require('lotion')
let coins = require('coins')

let app = lotion({
  // lotion options
  devMode: true
})

app.use(coins({
  // coins options
  name: 'kittycoin',
  initialBalances: {
    'BD3EaPRLquuHx7DMcSQ2YX54frnSEZ3YD': 21000000 // 填上你自己得到的地址
  }
}))

app.start().then(({ GCI }) => {
  console.log('App GCI:', GCI)
})
```

run app.js, and you can get GCI.

```sh
[root@localhost coins-test]# node app.js
App GCI: 037ee4e92643ee114415f9a0b97c1faf78e347f3324983fbfbc9196ecda1b5d7
```

then use `lotion` command to query the state

```sh
[root@localhost coins-test]# lotion state 037ee4e92643ee114415f9a0b97c1faf78e347f3324983fbfbc9196ecda1b5d7
{
  "accounts": {
    "8eMpgiig1KoqHMvxkUuemMKxkeMDSNwdQ": {
      "balance": 21000000,
      "sequence": 0
    }
  },
  "fee": {}
}
```

Then build a client:
`wallet.js`:
```js
let lotion = require('lotion');
let coins = require('coins');

async function main() {
  let client = await lotion.connect({Your_GCI}) // GCI you get from app.js
  let wallet = coins.wallet(Buffer.from({Your_Wallet_Seed}, 'hex'), client) // You can check your wallet seed from ~/.coin

  // wallet methods:
  let address = wallet.address()
  console.log("Address of wallet is " + address)

  let balance = await wallet.balance()
  console.log("balance is " + balance)

  let result = await wallet.send('04oDVBPIYP8h5V1eC1PSc5JU6Vo', 5)
  console.log("tx sending result is \n")
  console.log(result)
}

main()
```

Replace `YOUR_GCI` to the GCI you get from `app.js`.

run wallet.js

```sh
[root@localhost coins-test]# node wallet.js 
Address of wallet is 8eMpgiig1KoqHMvxkUuemMKxkeMDSNwdQ
balance is 21000000
tx sending result is 

{ check_tx: {},
  deliver_tx: {},
  hash: '8E7C40B70BA23DA5A1E413EBFDCE72FA5191F376',
  height: '206' }
```

and query the state again:

```sh
[root@localhost coins-test]# lotion state 037ee4e92643ee114415f9a0b97c1faf78e347f3324983fbfbc9196ecda1b5d7
{
  "accounts": {
    "04oDVBPIYP8h5V1eC1PSc5JU6Vo": {
      "balance": 5,
      "sequence": 0
    },
    "8eMpgiig1KoqHMvxkUuemMKxkeMDSNwdQ": {
      "balance": 20999995,
      "sequence": 1
    }
  },
  "fee": {}
}
```

### Writing your own advanced coin handler

`chain.js`:
```js
let coins = require('coins')
let lotion = require('lotion')

let app = lotion({})

app.use(coins({
    name: 'testcoin',
    initialBalances: {
      'judd': 10,
      'matt': 10
    },
    handlers: {
      'my-module': {
        onInput(input, state) {
          // this function is called when coins of
          // this type are used as a transaction input.

          // if the provided input isn't valid, throw an error.
          //if(isNotValid(input)) {
          //  throw Error('this input isn\'t valid!')
          //}

          // if the input is valid, update the state to
          // reflect the coins having been spent.
          state[input.senderAddress] = (state[input.senderAddress] || 0) - input.amount
        },

        onOutput(output, state) {
          // here's where you handle coins of this type
          // being received as a tx output.

          // usually you'll just want to mutate the state
          // to increment the balance of some address.
          state[output.receiverAddress] = (state[output.receiverAddress] || 0) + output.amount
        }
      }
    }
}))

app.start().then(({ GCI }) => {
  console.log('App GCI:', GCI)
})
```

run `node chain.js`

```sh
[root@localhost coins-test]# node chain.js 
App GCI: cac4e20583c945e7dee92a2d1ac6d63aafae286eaf544691af5b66b93ea1cd8f
```

use `lotion` command to query the state.

```sh
[root@localhost coins-test]# lotion state cac4e20583c945e7dee92a2d1ac6d63aafae286eaf544691af5b66b93ea1cd8f
{
  "accounts": {
    "judd": {
      "balance": 10,
      "sequence": 0
    },
    "matt": {
      "balance": 10,
      "sequence": 0
    }
  },
  "fee": {},
  "my-module": {}
}
```

then write
`client.js`:
```js
let lotion = require('lotion')
let client = await lotion.connect(YOUR_APP_GCI)

async function main() {
  let result = await client.send({
    from: [
      // tx inputs. each must include an amount:
      { amount: 4, type: 'my-module', senderAddress: 'judd' }
    ],
    to: [
      // tx outputs. sum of amounts must equal sum of amounts of inputs.
      { amount: 4, type: 'my-module', receiverAddress: 'matt' }
    ]
  })

  console.log(result)
}

main()
```

Replace `YOUR_APP_GCI` to the `GCI` you got.

then run `client.js`

```sh
[root@localhost coins-test]# node client.js 
{ check_tx: {},
  deliver_tx: {},
  hash: 'F3FA8FC8564C2D8FE49B54C14D3D6C1F19045384',
  height: '170' }
```

query the state

```sh
[root@localhost coins-test]# lotion state cac4e20583c945e7dee92a2d1ac6d63aafae286eaf544691af5b66b93ea1cd8f
{
  "accounts": {
    "judd": {
      "balance": 10,
      "sequence": 0
    },
    "matt": {
      "balance": 10,
      "sequence": 0
    }
  },
  "fee": {},
  "my-module": {
    "judd": -4,
    "matt": 4
  }
}
```


## License

MIT
