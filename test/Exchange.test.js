import {tokens, ether, EVM_REVERT, ETHER_ADDRESS} from './helpers'

const Token = artifacts.require('./Token')
const Exchange = artifacts.require('./Exchange')

require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('Exchange', ([deployer, feeAccount, user1, user2]) => {

  let token
  let exchange
  const feePercent = 10

  beforeEach(async () =>{ 
    // Deploy Token
    token = await Token.new()
    // Transfer some tokens to user1
    token.transfer(user1, tokens(100),{from: deployer})
    // Deploy Exchange
    exchange = await Exchange.new(feeAccount, feePercent)
  })


  describe('deployment', () =>{

    it('tracks the feeAccount', async () =>{
      const result = await exchange.feeAccount()
      result.should.equal(feeAccount)
    })
    
    it('tracks the feePercent', async () =>{
      const result = await exchange.feePercent()
      result.toString().should.equal(feePercent.toString())
    })
  })

  describe('fallback', () => {

    it('reverts Ether when is sent', async() => {
      await exchange.sendTransaction({value: 1, from: user1}).should.be.rejectedWith(EVM_REVERT)
    })
  }) 

  describe('depositing Ether', async ()=>{
    let result;
    let amount;
    let balance;

    beforeEach(async()=>{
      amount = ether(1)
      result = await exchange.depositEther({from: user1, value: amount}) 
    })

    it('tracks the Ether deposit', async () => {
      balance = await exchange.tokens(ETHER_ADDRESS, user1)
      balance.toString().should.eq(amount.toString())
    })
    it('emits a deposit event', async () => {
      const log = result.logs[0]
      log.event.should.eq('Deposit')
      const event = log.args
      event.token.should.eq(ETHER_ADDRESS,'Ether address is correct')
      event.user.should.eq(user1,'user address is correct')
      event.amount.toString().should.eq(amount.toString(),'amount is correct')
      event.balance.toString().should.eq(balance.toString(),'balance is correct')
    })
  })

  describe('Withdrawing Ether', async () => {
    let result;
    let amount;

    beforeEach(async () => {
      amount = ether(1)
      result = await exchange.depositEther({from: user1, value: amount}) 
    })

    describe('success', async () => {
      beforeEach(async()=>{
        result = await exchange.withdrawETH(amount, {from: user1})
      })
      it('withdraws Ether funds', async () => {
        const balance = await exchange.tokens(ETHER_ADDRESS, user1)
        balance.toString().should.eq('0')
      })
      it('emits a withdraw event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Withdraw')
        const event = log.args
        event.token.should.eq(ETHER_ADDRESS,'Ether address is correct')
        event.user.should.eq(user1,'user address is correct')
        event.amount.toString().should.eq(amount.toString(),'amount is correct')
        event.balance.toString().should.eq('0','balance is correct')
      })
    })
    describe('failure', async ()=> {
      it('rejects withdraw for insufficient balances', async () => {
        await exchange.withdrawETH(ether(100), {from: user1}).should.be.rejectedWith(EVM_REVERT)
      })
    }) 
  })

  describe('depositing tokens', () =>{
    let result;
    let amount;

    describe('success', () =>{
      let balance;

      beforeEach(async () =>{
        amount = tokens(10)
        await token.approve(exchange.address, amount,{from: user1}) 
        result = await exchange.depositToken(token.address, amount, {from: user1})
      })

      it('tracks the token deposit', async () =>{
        // check exchange token balance
        balance = await token.balanceOf(exchange.address)
        balance.toString().should.equal(amount.toString())
        // check tokens on exchange for user1
        balance = await exchange.tokens(token.address, user1)
        balance.toString().should.equal(amount.toString())
      })

      it('emits a deposit event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Deposit')
        const event = log.args
        event.token.should.eq(token.address,'token address is correct')
        event.user.should.eq(user1,'user address is correct')
        event.amount.toString().should.eq(amount.toString(),'amount is correct')
        event.balance.toString().should.eq(balance.toString(),'balance is correct')
      })
    })

    describe('failure', () =>{
      it('rejects ether deposits', async() =>{
        await exchange.depositToken(ETHER_ADDRESS, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
      })
      it('fails when no tokens are approved', async() =>{
        // don't approve any tokens before depositing
        await exchange.depositToken(token.address, tokens(10), {from: user1}).should.be.rejectedWith(EVM_REVERT)
      })
    })  
  })

  describe('Withdrawing tokens', async () => {
    let result;
    let amount;

    beforeEach(async () => {
      amount = tokens(10)
      await token.approve(exchange.address, amount,{from: user1}) 
      await exchange.depositToken(token.address, amount, {from: user1})

      // withdraw tokens
      result = await exchange.withdrawToken(token.address, amount, {from: user1})
    })

    describe('success', async () => {
      it('withdraws token funds', async () => {
        const balance = await exchange.tokens(token.address, user1)
        balance.toString().should.eq('0')
      })
      it('emits a withdraw event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Withdraw')
        const event = log.args
        event.token.should.eq(token.address,'token address is correct')
        event.user.should.eq(user1,'user address is correct')
        event.amount.toString().should.eq(amount.toString(),'amount is correct')
        event.balance.toString().should.eq('0','balance is correct')
      })
    })
    describe('failure', async ()=> {
      it('rejects ETHER withdraw', async () => {
        await exchange.withdrawToken(ETHER_ADDRESS, ether(100), {from: user1}).should.be.rejectedWith(EVM_REVERT)
      })
      it('rejects withdraw for insufficient balances', async () => {
        await exchange.withdrawToken(token.address, amount, {from: user1}).should.be.rejectedWith(EVM_REVERT)
      })
    }) 
  })
  describe('checking balances', async ()=> {
    beforeEach(async () => {
      await exchange.depositEther({from: user1, value: ether(1)})
    })
    it('returns user balance', async () => {
      const result = await exchange.balanceOf(ETHER_ADDRESS, user1)
      result.toString().should.eq(ether(1).toString())
    })
  }) 

  describe('making orders', async ()=> {
    let result

    beforeEach(async () => {
      result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), {from: user1})
    })
    it('tracks the newly created order', async () => {
      const orderCount = await exchange.orderCount()
      orderCount.toString().should.eq('1')
      const order = await exchange.orders('1')
      order.id.toString().should.eq('1', 'id is correct')
      order.user.should.eq(user1, 'user is correct')
      order.tokenGet.should.eq(token.address, 'tokenGet is correct')
      order.amountGet.toString().should.eq(tokens(1).toString(), 'amountGet is correct')
      order.tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct')
      order.amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct')
      order.timestamp.toString().length.should.be.at.least(1,'timestamp is present')
    })

    it('emits an Order event', async () => {
      const log = result.logs[0]
      log.event.should.eq('Order')
      const event = log.args
      event.id.toString().should.eq('1', 'id is correct')
      event.user.should.eq(user1, 'user is correct')
      event.tokenGet.should.eq(token.address, 'tokenGet is correct')
      event.amountGet.toString().should.eq(tokens(1).toString(), 'amountGet is correct')
      event.tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct')
      event.amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct')
      event.timestamp.toString().length.should.be.at.least(1,'timestamp is present')
    })
  })
  describe('order actions', async => {

    beforeEach(async () =>{
      // user1 deposits ether only
      await exchange.depositEther({from: user1, value: ether(1)})
      // give tokens to user2
      await token.transfer(user2, tokens(100), {from: deployer})
      // user 2 deposits tokens only
      await token.approve(exchange.address, tokens(2), {from: user2})
      await exchange.depositToken(token.address, tokens(2), {from: user2})
      // user 1 makes an order (first order _id is 1) to buy tokens with Ether
      await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), {from: user1}) 
    })

    describe('filling orders', async () =>{
      let result

      describe('success', async () =>{
        beforeEach(async () =>{
          // user2 fills and executes an order
          result = await exchange.fillOrder('1',{from: user2})
        })

        it('executes the trade & charges fees', async() =>{
        let balance
        balance = await exchange.balanceOf(token.address, user1)
          balance.toString().should.eq(tokens(1).toString(), 'user1 received tokens')
          balance = await exchange.balanceOf(ETHER_ADDRESS, user2)
          balance.toString().should.eq(ether(1).toString(), 'user2 received Ether')
          balance = await exchange.balanceOf(ETHER_ADDRESS, user1)
          balance.toString().should.eq('0', 'user1 Ether deducted')
          balance = await exchange.balanceOf(token.address, user2)
          balance.toString().should.eq(tokens(0.9).toString(), 'user2 tokens deducted with fee applied')
          const feeAccount = await exchange.feeAccount()
          balance = await exchange.balanceOf(token.address, feeAccount)
          balance.toString().should.eq(tokens(0.1).toString(), 'feeAccount received fee')
        })

        it('updates filled orders', async () => {
          const orderFilled = await exchange.orderFilled(1)
          orderFilled.should.eq(true)
        })

        it('emites a Trade event', async () => {
          const log = result.logs[0]
          log.event.should.eq('Trade')
          const event = log.args
          event.id.toString().should.eq('1', 'id is correct')
          event.user.should.eq(user1, 'user is correct')
          event.tokenGet.should.eq(token.address, 'tokenGet is correct')
          event.amountGet.toString().should.eq(tokens(1).toString(), 'amountGet is correct')
          event.tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct')
          event.amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct')
          event.userFill.should.eq(user2, 'userFill is correct')
          event.timestamp.toString().length.should.be.at.least(1,'timestamp is present')
        })
      })

      describe('failure', async () =>{

        it('rejects invalid order ids', async () =>{
          const invalidOrderId = 99999
          await exchange.fillOrder(invalidOrderId, {from: user2}).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects already-filled orders', async () =>{
          //Fill the order
          await exchange.fillOrder(1, {from: user2}).should.be.fulfilled
          // Try to fill it again
          await exchange.fillOrder(1, {from: user2}).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects cancelled orders', async () =>{
          // Cancel the order
          await exchange.cancelOrder('1', {from: user1}).should.be.fulfilled
          // Try to fill the order
          await exchange.fillOrder('1', {from: user2}).should.be.rejectedWith(EVM_REVERT)
        })

      })

    })

    describe('cancelling order', async () =>{
      let result

      describe('success', async () =>{
        beforeEach(async () =>{
          result = await exchange.cancelOrder('1', {from: user1})
        })
        it('updates cancelled orders', async () =>{
          const orderCancelled = await exchange.orderCancelled(1)
          orderCancelled.should.eq(true)
        })
        it('emits a Cancel event', async () =>{
          const log = result.logs[0]
          log.event.should.eq('Cancel')
          const event = log.args
          event.id.toString().should.eq('1', 'id is correct')
          event.user.should.eq(user1, 'user is correct')
          event.tokenGet.should.eq(token.address, 'tokenGet is correct')
          event.amountGet.toString().should.eq(tokens(1).toString(), 'amountGet is correct')
          event.tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct')
          event.amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct')
          event.timestamp.toString().length.should.be.at.least(1,'timestamp is present')
        })
      })

      describe('failure', async () =>{
        it('rejects invalid order id\'s', async () => {
          const invalidOrderId = 99999
          await exchange.cancelOrder(invalidOrderId,{from: user1}).should.be.rejectedWith(EVM_REVERT)
        })
        it('rejects unauthorized cancelations', async () => {
          // Try to cancel the order from another user
          await exchange.cancelOrder('1',{from: user2}).should.be.rejectedWith(EVM_REVERT)
        })
      })
    })
  })

})
