import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Account, Market } from "../generated/schema";
import { BalanceTransfer, Burn, Mint } from "../generated/templates/AToken/AToken"
import { createPositionSnapshot, getOrCreateAccount, getOrCreatePosition } from "./helpers/helpers"
import { NEG_ONE_BI, rayDiv, rayMul } from "./helpers/constants"


// hanldeBalanceTransfer sends aTokens from one account to another
export function handleBalanceTransfer(event: BalanceTransfer): void {
    const market = Market.load(event.address);
    if (!market) {
        log.error("Market not found for address: {}", [event.address.toHexString()]);
        return;
    }

    const fromAccount = getOrCreateAccount(event.params.from);
    updateSupplyBalance(event, fromAccount, market, event.params.value.times(NEG_ONE_BI), event.params.index);

    const toAccount = getOrCreateAccount(event.params.to);
    updateSupplyBalance(event, toAccount, market, event.params.value, event.params.index);
}

// handleMint adds aTokens to the supply/position
export function handleMint(event: Mint): void {
    const market = Market.load(event.address);
    if (!market) {
        log.error("Market not found for address: {}", [event.address.toHexString()]);
        return;
    }

    const account = getOrCreateAccount(event.params.onBehalfOf);
    const scaledAmount = rayDiv(event.params.value, event.params.index);
    updateSupplyBalance(event, account, market, scaledAmount, event.params.index);
}

// handleBurn removes aTokens from the supply/position
export function handleBurn(event: Burn): void {
    const market = Market.load(event.address);
    if (!market) {
        log.error("Market not found for address: {}", [event.address.toHexString()]);
        return;
    }

    const account = getOrCreateAccount(event.params.from);
    const scaledAmount = rayDiv(event.params.value, event.params.index).times(NEG_ONE_BI);
    updateSupplyBalance(event, account, market, scaledAmount, event.params.index);
}

function updateSupplyBalance(event: ethereum.Event, account: Account, market: Market, scaledAmount: BigInt, index: BigInt): void {
    let position = getOrCreatePosition(account, market, event.block.number);

    // update supply balance
    position.scaledSupply = position.scaledSupply.plus(scaledAmount);
    position.supplyBalance = rayMul(position.scaledSupply, index);
    position.liquidityIndex = index;

    position.netSupply = position.supplyBalance.minus(position.debtBalance);
    position.save();

    createPositionSnapshot(position, event);
}
