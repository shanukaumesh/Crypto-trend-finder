import React from "react";
import SignalDashboard from "./components/SignalDashboard.jsx";
import "./App.css";

const App = () => {
  const [currentDate, setCurrentDate] = React.useState(new Date().toLocaleDateString());
  const [currentTime, setCurrentTime] = React.useState(new Date().toLocaleTimeString());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date().toLocaleDateString());
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="App">
      <div className="App-header">
      <h2>Trading Strategy Dashboard</h2>
      <h4>Date: {currentDate}</h4>
      <h4>Time: {currentTime}</h4>
      </div>
      <SignalDashboard />
    </div>
  );
};

export default App;