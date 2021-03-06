import React, { useCallback, useState, useEffect } from "react";
import { Flex, Box } from "reflexbox";
import Bar from "@aragon/ui/dist/Bar";
import BackButton from "@aragon/ui/dist/BackButton";
import AuiBox from "@aragon/ui/dist/Box";
import { textStyle } from "@aragon/ui/dist/text-styles";
import { useTheme } from "@aragon/ui/dist/Theme";
import IdentityBadge from "@aragon/ui/dist/IdentityBadge";
import ProgressBar from "@aragon/ui/dist/ProgressBar";
import Radio from "@aragon/ui/dist/Radio";
import { DateTime } from "luxon";
import BigNumber from "bignumber.js";
import Timer from "@aragon/ui/dist/Timer";
import IconCheck from "@aragon/ui/dist/IconCheck";
import Button from "@aragon/ui/dist/Button";
import { TradingSidePanel } from "./trading-side-panel";
import { useAragonApi } from "@aragon/api-react";
import { toWei, fromWei } from "web3-utils";
import { CloseSidePanel } from "./close-side-panel";
import { IconError } from "@aragon/ui";

export const Market = ({
    onBack,
    conditionId,
    questionId,
    question,
    creator,
    outcomes,
    timestamp,
    endsAt,
    redeemed,
    open,
    onTrade,
    onClose,
    connectedAccount,
}) => {
    const { api } = useAragonApi();

    const theme = useTheme();
    const [checked, setChecked] = useState(outcomes[0]);
    const [luxonTimestamp, setLuxonTimestamp] = useState(null);
    const [tradeable, setTradeable] = useState(null);
    const [canSell, setCanSell] = useState(new BigNumber("0"));
    const [redeemable, setRedeemable] = useState(false);
    const [buying, setBuying] = useState(false);
    const [selling, setSelling] = useState(false);
    const [closing, setClosing] = useState(false);
    const [sharesAmount, setSharesAmount] = useState("");
    const [netCost, setNetCost] = useState("");
    const [fee, setFee] = useState("");

    useEffect(() => {
        setLuxonTimestamp(DateTime.fromSeconds(timestamp));
    }, [timestamp]);

    useEffect(() => {
        setTradeable(open && endsAt > new Date().getTime() / 1000);
    }, [endsAt, open]);

    useEffect(() => {
        setCanSell(new BigNumber(fromWei(checked.balance)));
    }, [checked, endsAt, outcomes]);

    useEffect(() => {
        setRedeemable(
            !open &&
                !redeemed &&
                outcomes.find((outcome) =>
                    new BigNumber(outcome.balance).isGreaterThan("0")
                )
        );
    }, [checked, endsAt, open, outcomes, redeemed]);

    const handleRadioChange = useCallback(
        (index) => {
            setChecked(outcomes[index]);
        },
        [outcomes]
    );

    const handleBuyClick = useCallback(() => {
        setBuying(true);
    }, []);

    const handleSellClick = useCallback(() => {
        setSelling(true);
    }, []);

    const handleTradingSidePanelClose = useCallback(() => {
        setBuying(false);
        setSelling(false);
        setSharesAmount("");
    }, []);

    const handleSharesAmountChange = useCallback(
        (event) => {
            let sharesAmount = event.target.value;
            if (
                selling &&
                new BigNumber(event.target.value).isGreaterThan(canSell)
            ) {
                sharesAmount = canSell.toString();
            }
            setSharesAmount(sharesAmount);
            if (sharesAmount) {
                api.call(
                    "getNetCost",
                    outcomes.map((outcome) =>
                        outcome === checked ? toWei(sharesAmount) : "0"
                    ),
                    conditionId
                ).subscribe((weiNetCost) => {
                    setNetCost(fromWei(weiNetCost, "ether"));
                    api.call("getMarketFee", conditionId, weiNetCost).subscribe(
                        (weiFee) => {
                            setFee(fromWei(weiFee, "ether"));
                        },
                        console.error
                    );
                }, console.error);
            }
        },
        [selling, canSell, api, outcomes, conditionId, checked]
    );

    const handleTrade = useCallback(
        (collateral) => {
            const outcomeTokensAmount = outcomes
                .map((mappingOutcome) =>
                    mappingOutcome === checked ? sharesAmount : 0
                )
                .map((amount) => (buying || amount === 0 ? amount : -amount));
            onTrade(
                conditionId,
                outcomeTokensAmount,
                buying || collateral === 0 ? collateral : -collateral,
                selling
            );
        },
        [buying, checked, conditionId, onTrade, outcomes, selling, sharesAmount]
    );

    const handleCloseMarket = useCallback(() => {
        setClosing(true);
    }, []);

    const handleCloseMarketClose = useCallback(() => {
        setClosing(false);
    }, []);

    const handleCloseMarketConfirm = useCallback(
        (outcome) => {
            onClose(
                conditionId,
                questionId,
                outcomes.map((mappedOutcome) =>
                    mappedOutcome === outcome ? "1" : "0"
                )
            );
        },
        [conditionId, onClose, outcomes, questionId]
    );

    const handleRedeemPositions = useCallback(() => {
        api.redeemPositions(
            outcomes.map((outcome, index) => index + 1),
            conditionId
        ).subscribe();
    }, [api, conditionId, outcomes]);

    return (
        <>
            <Flex flexWrap="wrap" pt="16px" width="100%" flexDirection="column">
                <Box>
                    <Bar primary={<BackButton onClick={onBack} />} />
                </Box>
                <Box mb="16px">
                    <AuiBox width="100%">
                        <Flex
                            width="100%"
                            height="100%"
                            flexDirection="column"
                            p="40px"
                        >
                            <Box
                                mb="8px"
                                css={`
                                ${textStyle("label2")}
                                    color: ${theme.contentSecondary};
                                `}
                            >
                                Created by
                            </Box>
                            <Box mb="24px">
                                <IdentityBadge
                                    entity={creator}
                                    badgeOnly
                                    shorten
                                />
                            </Box>
                            <Box
                                mb="8px"
                                css={`
                                ${textStyle("label2")}
                                color: ${theme.contentSecondary};
                            `}
                            >
                                Open since
                            </Box>
                            <Box
                                mb="24px"
                                css={`
                                ${textStyle("body2")}
                                color: ${theme.content};
                            `}
                            >
                                {luxonTimestamp &&
                                    luxonTimestamp.toLocaleString(
                                        DateTime.DATETIME_SHORT
                                    )}
                            </Box>
                            <Box
                                mb="8px"
                                css={`
                                    ${textStyle("label2")}
                                    color: ${theme.contentSecondary};
                                `}
                            >
                                Status
                            </Box>
                            <Flex
                                mb="24px"
                                css={`
                                    ${textStyle("label2")}
                                    color: ${
                                        tradeable
                                            ? theme.positive
                                            : theme.negative
                                    };
                                `}
                                display="flex"
                                alignItems="center"
                                height="30px"
                            >
                                <Box mr="2px">
                                    {tradeable ? <IconCheck /> : <IconError />}
                                </Box>
                                <Box
                                    css={`
                                        ${textStyle("body2")}
                                    `}
                                    pb="4px"
                                >
                                    {tradeable ? "Open" : "Closed"}{" "}
                                </Box>
                                {tradeable && (
                                    <Box ml="8px" pb="4px">
                                        <Timer end={new Date(endsAt * 1000)} />
                                    </Box>
                                )}
                            </Flex>
                            <Box
                                mb="8px"
                                css={`
                                ${textStyle("label2")}
                                color: ${theme.contentSecondary};
                            `}
                            >
                                Question
                            </Box>
                            <Box
                                mb="24px"
                                css={`
                                ${textStyle("body2")}
                                color: ${theme.content};
                            `}
                            >
                                {question}
                            </Box>
                            <Box
                                mb="8px"
                                css={`
                                ${textStyle("label2")}
                                color: ${theme.contentSecondary};
                            `}
                            >
                                Outcomes
                            </Box>
                            {outcomes.map((outcome, index) => {
                                const prettyPrice = new BigNumber(
                                    outcome.price
                                );
                                const prettyBalance = new BigNumber(
                                    fromWei(outcome.balance)
                                );
                                const resultIcon =
                                    !open && outcome.correct ? (
                                        <IconCheck />
                                    ) : (
                                        <IconError />
                                    );
                                return (
                                    <Flex
                                        key={index}
                                        alignItems="center"
                                        width="100%"
                                        mb="16px"
                                    >
                                        {tradeable && (
                                            <Box
                                                mr="16px"
                                                display="flex"
                                                alignItems="center"
                                            >
                                                <Radio
                                                    id={index}
                                                    checked={
                                                        checked === outcome
                                                    }
                                                    onChange={handleRadioChange}
                                                />
                                            </Box>
                                        )}
                                        <Flex
                                            flexDirection="column"
                                            width="100%"
                                        >
                                            <Box
                                                css={`
                                                    ${textStyle("label2")}
                                                `}
                                            >
                                                {outcome.label} (
                                                {prettyPrice
                                                    .multipliedBy("100")
                                                    .decimalPlaces(2)
                                                    .toString()}
                                                %)
                                            </Box>
                                            <Flex
                                                height="24px"
                                                width="100%"
                                                alignItems="center"
                                            >
                                                <Box width="100%">
                                                    <ProgressBar
                                                        value={prettyPrice.toNumber()}
                                                    />
                                                </Box>
                                                {!open && (
                                                    <Box ml="16px">
                                                        {resultIcon}
                                                    </Box>
                                                )}
                                            </Flex>
                                            <Box
                                                css={`
                                                    ${textStyle("label2")}
                                                `}
                                            >
                                                Balance:{" "}
                                                {prettyBalance
                                                    .decimalPlaces(4)
                                                    .toString()}
                                            </Box>
                                        </Flex>
                                    </Flex>
                                );
                            })}
                            {tradeable && (
                                <Flex mt="16px" justifyContent="space-around">
                                    <Button
                                        mode="positive"
                                        onClick={handleBuyClick}
                                    >
                                        Buy
                                    </Button>
                                    <Button
                                        mode="negative"
                                        disabled={canSell.isZero()}
                                        onClick={handleSellClick}
                                    >
                                        Sell
                                    </Button>
                                </Flex>
                            )}
                        </Flex>
                    </AuiBox>
                    {((tradeable && connectedAccount === creator) ||
                        redeemable) && (
                        <AuiBox width="100%" heading="Actions" padding={20}>
                            {tradeable && (
                                <Button
                                    mode="negative"
                                    onClick={handleCloseMarket}
                                >
                                    Close market
                                </Button>
                            )}
                            {redeemable && (
                                <Button
                                    mode="positive"
                                    onClick={handleRedeemPositions}
                                >
                                    Redeem positions
                                </Button>
                            )}
                        </AuiBox>
                    )}
                </Box>
            </Flex>
            <TradingSidePanel
                open={buying || selling}
                onClose={handleTradingSidePanelClose}
                sharesAmount={sharesAmount}
                netCost={netCost}
                fee={fee}
                onChange={handleSharesAmountChange}
                buy={buying}
                outcomeLabel={checked.label.toLowerCase()}
                onTrade={handleTrade}
            />
            <CloseSidePanel
                open={closing}
                onClose={handleCloseMarketClose}
                outcomes={outcomes}
                onConfirm={handleCloseMarketConfirm}
            />
        </>
    );
};
