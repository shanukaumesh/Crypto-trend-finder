import React from "react";
import SignalDashboard from "./components/SignalDashboard.jsx";
import "./App.css";
import { FaSun, FaMoon } from "react-icons/fa"; // Import icons

const App = () => {
  const [currentDate, setCurrentDate] = React.useState(new Date().toLocaleDateString());
  const [currentTime, setCurrentTime] = React.useState(new Date().toLocaleTimeString());
  const [theme, setTheme] = React.useState("light"); // State to manage theme

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date().toLocaleDateString());
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <div className={`App ${theme}`}>
      <div className="App-header">
        <h2>Trading Strategy Dashboard</h2>
        <h4>Date: {currentDate}</h4>
        <h4>Time: {currentTime}</h4>
        <button onClick={toggleTheme} className="theme-toggle">
          {theme === "light" ? <FaMoon /> : <FaSun />} {/* Use icons */}
        </button>
      </div>
      <SignalDashboard theme={theme} />
    </div>
  );
};

export default App;
