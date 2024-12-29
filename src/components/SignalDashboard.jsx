import React, { useState, useEffect } from "react";
import axios from "axios";
import Chart from "react-apexcharts";
import "./App.css"; // Link to the CSS file

const calculateIndicators = (data) => {
  const closePrices = data.map((item) => parseFloat(item[4]));

  const EMA = (prices, period) => {
    const k = 2 / (period + 1);
    return prices.reduce((acc, price, index) => {
      if (index === 0) return [price];
      acc.push(price * k + acc[index - 1] * (1 - k));
      return acc;
    }, []);
  };

  const RSI = (prices, period = 14) => {
    const deltas = prices.slice(1).map((val, idx) => val - prices[idx]);
    const gains = deltas.map((val) => (val > 0 ? val : 0));
    const losses = deltas.map((val) => (val < 0 ? -val : 0));

    const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

    let rsi = [100 - 100 / (1 + avgGain / avgLoss)];

    for (let i = period; i < prices.length; i++) {
      const gain = gains[i] || 0;
      const loss = losses[i] || 0;
      const currentGain = (avgGain * (period - 1) + gain) / period;
      const currentLoss = (avgLoss * (period - 1) + loss) / period;
      rsi.push(100 - 100 / (1 + currentGain / currentLoss));
    }

    return rsi;
  };

  return {
    ema20: EMA(closePrices, 20),
    ema50: EMA(closePrices, 50),
    rsi: RSI(closePrices, 14),
  };
};

const SignalDashboard = () => {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tradingPairs, setTradingPairs] = useState([]);
  const [data, setData] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [trend, setTrend] = useState("");
  const [signals, setSignals] = useState([]);
  const [timeframe, setTimeframe] = useState({
    trend: "1h",
    analysis: "15m",
  });

  const determineLeverage = (data, rsi, timeframe) => {
    // Calculate market volatility
    const prices = data.map((item) => parseFloat(item[4])); // Closing prices
    const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const priceDeviations = prices.map((price) => Math.abs(price - averagePrice));
    const volatility = priceDeviations.reduce((a, b) => a + b, 0) / priceDeviations.length;
  
    // Determine leverage based on volatility
    let leverage = 10; // Default leverage
    if (volatility > 0.02 * averagePrice) leverage = 5; // High volatility, lower leverage
    else if (volatility < 0.01 * averagePrice) leverage = 15; // Low volatility, higher leverage
  
    // Adjust leverage based on RSI
    if (rsi < 30 || rsi > 70) leverage -= 2; // Overbought/Oversold → lower leverage
    if (rsi >= 40 && rsi <= 60) leverage += 2; // Neutral RSI → higher leverage
  
    // Adjust leverage based on timeframe
    if (timeframe === "5m" || timeframe === "15m") leverage += 3; // Shorter timeframe → higher leverage
    if (timeframe === "4h" || timeframe === "1h") leverage -= 2; // Longer timeframe → lower leverage
  
    // Ensure leverage stays within safe bounds
    return Math.max(1, Math.min(leverage, 20)); // Leverage capped between 1x and 20x
  };
  

  const fetchTradingPairs = async () => {
    try {
      const response = await axios.get("https://fapi.binance.com/fapi/v1/exchangeInfo");
      const pairs = response.data.symbols.map((symbol) => symbol.symbol);
      setTradingPairs(pairs);
    } catch (error) {
      console.error("Error fetching trading pairs:", error);
    }
  };

  useEffect(() => {
    fetchTradingPairs();
  }, []);

  const fetchCryptoData = async (symbol, interval) => {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=200`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      return null;
    }
  };

  const analyzeTrend = (ema20, ema50) => {
    return ema20[ema20.length - 1] > ema50[ema50.length - 1] ? "UPTREND" : "DOWNTREND";
  };

  const generateSignals = (indicators, data) => {
    const buySignals = [];
    const sellSignals = [];
  
    data.forEach((item, index) => {
      if (index < 50) return;
  
      const currentPrice = parseFloat(item[4]);
      const ema20 = indicators.ema20[index];
      const ema50 = indicators.ema50[index];
      const rsi = indicators.rsi[index];
      const volume = parseFloat(item[5]);
      const prevVolume = index > 0 ? parseFloat(data[index - 1][5]) : 0;
  
      const leverage = determineLeverage(data.slice(index - 50, index), rsi, timeframe.analysis); // Dynamic leverage
      const takeProfitPercent = 1.5; // 1.5% profit
      const stopLossPercent = 1.0; // 1% loss
  
      const calculateTakeProfit = (entry) => entry + (entry * takeProfitPercent) / 100;
      const calculateStopLoss = (entry) => entry - (entry * stopLossPercent) / 100;
  
      const signalTime = new Date(item[0]).toLocaleString();
  
      if (
        trend === "UPTREND" &&
        currentPrice >= ema20 &&
        currentPrice <= ema50 &&
        rsi >= 40 &&
        rsi <= 60 &&
        volume > prevVolume
      ) {
        buySignals.push({
          type: "buy",
          time: signalTime,
          price: currentPrice,
          leverage: leverage,
          takeProfit: calculateTakeProfit(currentPrice),
          stopLoss: calculateStopLoss(currentPrice),
        });
      }
  
      if (
        trend === "DOWNTREND" &&
        currentPrice <= ema20 &&
        currentPrice >= ema50 &&
        rsi >= 40 &&
        rsi <= 60 &&
        volume > prevVolume
      ) {
        sellSignals.push({
          type: "sell",
          time: signalTime,
          price: currentPrice,
          leverage: leverage,
          takeProfit: calculateStopLoss(currentPrice),
          stopLoss: calculateTakeProfit(currentPrice),
        });
      }
    });
  
    setSignals([...buySignals, ...sellSignals]);
  };
  
  
  useEffect(() => {
    const fetchAndAnalyze = async () => {
      const oneHourData = await fetchCryptoData(symbol, timeframe.trend);
      const fifteenMinuteData = await fetchCryptoData(symbol, timeframe.analysis);

      if (oneHourData && fifteenMinuteData) {
        const oneHourIndicators = calculateIndicators(oneHourData);
        const fifteenMinuteIndicators = calculateIndicators(fifteenMinuteData);

        setTrend(analyzeTrend(oneHourIndicators.ema20, oneHourIndicators.ema50));
        setIndicators(fifteenMinuteIndicators);
        setData(fifteenMinuteData);

        generateSignals(fifteenMinuteIndicators, fifteenMinuteData);
      }
    };

    fetchAndAnalyze();
  }, [symbol, timeframe]);

  const chartOptions = {
    chart: { id: "price-chart" },
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "Price" } },
  };

  const chartSeries = [
    {
      name: "Price",
      data: data.map((item) => ({
        x: new Date(item[0]),
        y: [parseFloat(item[1]), parseFloat(item[2]), parseFloat(item[3]), parseFloat(item[4])],
      })),
    },
  ];

  return (
    <div className="dashboard">
      
      

      <div className="controls">
        <label>Trading Pair: </label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="dropdown"
        >
          {tradingPairs.map((pair) => (
            <option key={pair} value={pair}>
              {pair}
            </option>
          ))}
        </select>

        <label>Trend Timeframe: </label>
        <select
          value={timeframe.trend}
          onChange={(e) => setTimeframe({ ...timeframe, trend: e.target.value })}
          className="dropdown"
        >
          <option value="1h">1H</option>
          <option value="4h">4H</option>
          <option value="15m">15M</option>
          <option value="5m">5M</option>
        </select>

        <label>Analysis Timeframe: </label>
        <select
          value={timeframe.analysis}
          onChange={(e) => setTimeframe({ ...timeframe, analysis: e.target.value })}
          className="dropdown"
        >
          <option value="4h">4H</option>
          <option value="1h">1H</option>
          <option value="15m">15M</option>
          <option value="5m">5M</option>
        </select>
      </div>

      <h3>{timeframe.trend} Chart Trend: {trend}</h3>

      <div className="chart">
        <Chart options={chartOptions} series={chartSeries} type="candlestick" height="400" />
      </div>

      <h4>Buy/Sell Signals</h4>
<ul className="signals">
  {signals.map((signal, index) => (
    <li key={index} className={signal.type === "buy" ? "buy-signal" : "sell-signal"}>
      <div>
        <strong>Type:</strong> {signal.type.toUpperCase()}
      </div>
      <div>
        <strong>Time:</strong> {signal.time}
      </div>
      <div>
        <strong>Entry Position:</strong> {signal.price}
      </div>
      <div>
        <strong>Leverage:</strong> {signal.leverage}x
      </div>
      <div>
        <strong>Take Profit:</strong> {signal.takeProfit.toFixed(5)}
      </div>
      <div>
        <strong>Stop Loss:</strong> {signal.stopLoss.toFixed(5)}
      </div>
    </li>
  ))}
</ul>

    </div>
  );
};

export default SignalDashboard;
