/* eslint-disable no-undef */
const { newDao, newApp } = require("./helpers/dao");
const { setOpenPermission } = require("./helpers/permissions");
const { toWei, asciiToHex } = require("web3-utils");
const { newMarket } = require("./helpers/markets");

const PredictionMarketsApp = artifacts.require("PredictionMarketsApp.sol");

// eslint-disable-next-line no-undef
contract("PredictionMarketsApp", ([appManager, user]) => {
    let appBase, app, conditionalTokensInstance;

    before("deploy base app", async () => {
        appBase = await PredictionMarketsApp.new();
    });

    beforeEach("deploy dao and app", async () => {
        const { dao, acl } = await newDao(appManager);

        const proxyAddress = await newApp(
            dao,
            "prediction-markets",
            appBase.address,
            appManager
        );
        app = await PredictionMarketsApp.at(proxyAddress);

        await setOpenPermission(
            acl,
            app.address,
            await app.CREATE_MARKET_ROLE(),
            appManager
        );
        await setOpenPermission(
            acl,
            app.address,
            await app.TRADE_ROLE(),
            appManager
        );
        await setOpenPermission(
            acl,
            app.address,
            await app.CLOSE_MARKET_ROLE(),
            appManager
        );

        const ConditionalTokens = artifacts.require("ConditionalTokens.sol");
        const Fixed192x64Math = artifacts.require("Fixed192x64Math.sol");
        const LMSRMarketMakerFactory = artifacts.require(
            "LMSRMarketMakerFactory.sol"
        );
        const WETH9 = artifacts.require("WETH9.sol");

        const fixed192x64MathInstance = await Fixed192x64Math.new({
            from: appManager,
        });
        conditionalTokensInstance = await ConditionalTokens.new({
            from: appManager,
        });
        const weth9Instance = await WETH9.new({ from: appManager });

        await LMSRMarketMakerFactory.link(fixed192x64MathInstance);
        const lsmrMarketMakerFactoryInstance = await LMSRMarketMakerFactory.new(
            { from: appManager }
        );

        await app.initialize(
            conditionalTokensInstance.address,
            lsmrMarketMakerFactoryInstance.address,
            weth9Instance.address
        );
    });

    it("should guarantee a market creation to anyone", async () => {
        await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
    });

    it("should let a user perform a buy", async () => {
        let receipt = await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
        const createMarketEvent = receipt.logs.find(
            (log) => log.event === "CreateMarket"
        );
        if (!createMarketEvent) {
            throw new Error("no create market event");
        }
        const { conditionId } = createMarketEvent.args;
        const wantedShares = toWei("0.123");
        const outcomeTokens = [wantedShares, "0"];
        const netCost = await app.getNetCost(outcomeTokens, conditionId);
        const fee = await app.getMarketFee(conditionId, netCost.toString());
        const totalCost = netCost.add(fee);
        await app.buy(conditionId, [wantedShares, "0"], totalCost, {
            from: user,
            value: totalCost,
        });
        const collateralTokenAddress = await app.weth9Token();
        const collectionId = await app.getCollectionId(
            asciiToHex(""),
            conditionId,
            1
        );
        const positionId = await app.getPositionId(
            collateralTokenAddress,
            collectionId
        );
        assert.equal(
            (await app.balanceOf(positionId, { from: user })).toString(),
            wantedShares
        );
    });

    it("should let a user perform a sell", async () => {
        let receipt = await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
        const createMarketEvent = receipt.logs.find(
            (log) => log.event === "CreateMarket"
        );
        if (!createMarketEvent) {
            throw new Error("no create market event");
        }
        const { conditionId } = createMarketEvent.args;
        const wantedShares = toWei("1");
        const outcomeTokens = [wantedShares, "0"];
        const netCost = await app.getNetCost(outcomeTokens, conditionId);
        const fee = await app.getMarketFee(conditionId, netCost.toString());
        const totalCost = netCost.add(fee);
        await app.buy(conditionId, [wantedShares, "0"], totalCost.toString(), {
            from: user,
            value: totalCost.toString(),
        });
        const collateralTokenAddress = await app.weth9Token();
        const collectionId = await app.getCollectionId(
            asciiToHex(""),
            conditionId,
            1
        );
        const positionId = await app.getPositionId(
            collateralTokenAddress,
            collectionId
        );
        const onchainBalance = (
            await app.balanceOf(positionId, { from: user })
        ).toString();
        assert.equal(onchainBalance, wantedShares);
        await app.sell(conditionId, [`-${onchainBalance}`, "0"], "0", {
            from: user,
        });
    });

    it("shouldn't let a user sell more than what they have", async () => {
        let receipt = await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
        const createMarketEvent = receipt.logs.find(
            (log) => log.event === "CreateMarket"
        );
        if (!createMarketEvent) {
            throw new Error("no create market event");
        }
        const { conditionId } = createMarketEvent.args;
        const wantedShares = toWei("1");
        const outcomeTokens = [wantedShares, "0"];
        const netCost = await app.getNetCost(outcomeTokens, conditionId);
        const fee = await app.getMarketFee(conditionId, netCost.toString());
        const totalCost = netCost.add(fee);
        await app.buy(conditionId, [wantedShares, "0"], totalCost.toString(), {
            from: user,
            value: totalCost.toString(),
        });
        const collateralTokenAddress = await app.weth9Token();
        const collectionId = await app.getCollectionId(
            asciiToHex(""),
            conditionId,
            1
        );
        const positionId = await app.getPositionId(
            collateralTokenAddress,
            collectionId
        );
        const onchainBalance = (
            await app.balanceOf(positionId, { from: user })
        ).toString();
        assert.equal(onchainBalance, wantedShares);
        try {
            await app.sell(
                conditionId,
                [`-${onchainBalance + 10000}`, "0"],
                "0",
                {
                    from: user,
                }
            );
        } catch (error) {
            assert.equal(
                "Returned error: VM Exception while processing transaction: revert INSUFFICIENT_BALANCE",
                error.message
            );
        }
    });

    it("should let a user close a market", async () => {
        let receipt = await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
        const createMarketEvent = receipt.logs.find(
            (log) => log.event === "CreateMarket"
        );
        if (!createMarketEvent) {
            throw new Error("no create market event");
        }
        const { conditionId } = createMarketEvent.args;
        const { questionId } = await app.marketData(conditionId, {
            from: user,
        });
        await app.closeMarket(["1", "0"], conditionId, questionId, {
            from: user,
        });
    });

    it("should let a user redeem their positions", async () => {
        let receipt = await newMarket(
            app,
            user,
            "test-question",
            ["test-outcome-1", "test-outcome-2"],
            parseInt(Date.now() / 1000) + 1000,
            "1"
        );
        const createMarketEvent = receipt.logs.find(
            (log) => log.event === "CreateMarket"
        );
        if (!createMarketEvent) {
            throw new Error("no create market event");
        }
        const { conditionId } = createMarketEvent.args;
        const wantedShares = toWei("1");
        const outcomeTokens = [wantedShares, "0"];
        const netCost = await app.getNetCost(outcomeTokens, conditionId);
        const fee = await app.getMarketFee(conditionId, netCost.toString());
        const totalCost = netCost.add(fee);
        await app.buy(conditionId, [wantedShares, "0"], totalCost.toString(), {
            from: user,
            value: totalCost.toString(),
        });
        const collateralTokenAddress = await app.weth9Token();
        const collectionId = await app.getCollectionId(
            asciiToHex(""),
            conditionId,
            1
        );
        const positionId = await app.getPositionId(
            collateralTokenAddress,
            collectionId
        );
        const onchainBalance = (
            await app.balanceOf(positionId, { from: user })
        ).toString();
        assert.equal(onchainBalance, wantedShares);
        const { questionId } = await app.marketData(conditionId, {
            from: user,
        });
        await app.closeMarket(["1", "0"], conditionId, questionId, {
            from: user,
        });
        await app.redeemPositions(["1", "2"], conditionId, {
            from: user,
        });
    });
});
