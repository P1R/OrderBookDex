import {tokens, EVM_REVERT} from './helpers'
const Token = artifacts.require('./Token')

require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('Token', ([deployer, receiver, exchange]) => {
  const name = 'TACOIN'
  const symbol = 'TACO'
  const decimals = '18'
  const totalSupply = tokens(1000000).toString()

  let token

  beforeEach(async () =>{ 
    // fetch token from the blockchain
    token = await Token.new()
  })


  describe('deployment', () =>{

    it('tracks the name', async () =>{
      const result = await token.name()
      result.should.equal(name)
    })

    it('tracks the symbol', async () =>{
      const result = await token.symbol()
      result.should.equal(symbol)
    })

    it('tracks the decimals', async () =>{
      const result = await token.decimals()
      result.toString().should.equal(decimals)
    })

    it('tracks the total supply', async () =>{
      const result = await token.totalSupply()
      result.toString().should.equal(totalSupply)
    })
    it('assigns the total supply to the deployer', async () =>{
      const result = await token.balanceOf(deployer)
      result.toString().should.equal(totalSupply)
    })
  })

  describe('sending tokens', () => {
    let result
    let amount
    
    describe('success', async() =>{
      
      beforeEach(async () =>{ 
        // fetch token from the blockchain
        amount = tokens(100)
        result = await token.transfer(receiver, amount, {from: deployer}) 
      })
      it('transfer token balances', async () =>{
        let balanceOf
        // Transfer
        balanceOf = await token.balanceOf(deployer)
        balanceOf.toString().should.equal(tokens(999900).toString())
        balanceOf = await token.balanceOf(receiver)
        balanceOf.toString().should.equal(tokens(100).toString())
      })
      it('emits a transfer event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Transfer')
        const event = log.args
        event.from.should.eq(deployer,'from is correct')
        event.to.should.eq(receiver,'to is correct')
        event.value.toString().should.eq(amount.toString(),'value is correct')

      })
    })

    describe('failure', async() =>{

      it('rejects insuficient balances', async () =>{
        let invalidAmount
        invalidAmount = tokens(100000000) // 100 million - greater than totat supply
        await token.transfer(receiver, invalidAmount, {from: deployer}).should.be.rejectedWith(EVM_REVERT)
        // Attempt transfer tokens, when you have none
        invalidAmount = tokens(10) // recepient has no tokens
        await token.transfer(deployer, invalidAmount, {from: receiver}).should.be.rejectedWith(EVM_REVERT)
      })
      it('rejects invalid recepients', async() => {
        await token.transfer(0x0, amount, {from: deployer}).should.be.rejected
      })
    })
  })

  describe('approving tokens', () => {
    let result
    let amount

    beforeEach(async () =>{ 
      // fetch token from the blockchain
      amount = tokens(100)
      result = await token.approve(exchange, amount, {from: deployer}) 
    })
    describe('success', async() =>{
      it('allocates an allowance for delegated token spending on an exchange', async() =>{
        const allowance = await token.allowance(deployer, exchange)
        allowance.toString().should.equal(amount.toString())
      })
      it('emits an Approval event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Approval')
        const event = log.args
        event.owner.should.eq(deployer,'owner is correct')
        event.spender.should.eq(exchange,'spender is correct')
        event.value.toString().should.eq(amount.toString(),'value is correct')
      })
    })
    describe('failure', async() =>{
      it('rejects invalid spenders', async() => {
        await token.approve(0x0, amount, {from: deployer}).should.be.rejected
      })
    })
  })

  describe('delegated token transfers', () => {
    let result
    let amount
    
    beforeEach(async () =>{ 
      amount = tokens(100)
      result = await token.approve(exchange, amount, {from: deployer}) 
    })
    describe('success', async() =>{
      
      beforeEach(async () =>{ 
        result = await token.transferFrom(deployer, receiver, amount, {from: exchange}) 
      })
      it('transfer token balances', async () =>{
        let balanceOf
        // Transfer
        balanceOf = await token.balanceOf(deployer)
        balanceOf.toString().should.equal(tokens(999900).toString())
        balanceOf = await token.balanceOf(receiver)
        balanceOf.toString().should.equal(tokens(100).toString())
      })
      it('resets the allowance', async() =>{
        const allowance = await token.allowance(deployer, exchange)
        allowance.toString().should.equal('0')
      })
      it('emits a transfer event', async () => {
        const log = result.logs[0]
        log.event.should.eq('Transfer')
        const event = log.args
        event.from.should.eq(deployer,'from is correct')
        event.to.should.eq(receiver,'to is correct')
        event.value.toString().should.eq(amount.toString(),'value is correct')

      })
    })

    describe('failure', async() =>{
      it('rejects insuficient amounts', async () =>{
        // attempt transfer to many tokens
        const invalidAmount = tokens(100000000) // 100 million - greater than totat supply
        await token.transferFrom(deployer, receiver, invalidAmount, {from: exchange}).should.be.rejectedWith(EVM_REVERT)
      })
      it('rejects invalid recepients', async() => {
        await token.transfer(deployer, 0x0, amount, {from: exchange}).should.be.rejected
      })
    })
  })
})
