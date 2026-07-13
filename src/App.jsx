import { useEffect, useState } from "react";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        // Check if Google sent us a new token
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");

        if (urlToken) {
            localStorage.setItem("token", urlToken);

            // Remove ?token=... from the URL
            window.history.replaceState({}, "", "/");
        }

        const token = localStorage.getItem("token");

        // No token? Show login page.
        if (!token) {
            setLoading(false);
            return;
        }

        fetch("http://localhost:5000/api/auth/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            setUser(data);
            setLoading(false);
        })
        .catch(error => {
            console.error(error);
            setLoading(false);
        });

    }, []);

    if (loading) {
        return <h2>Loading...</h2>;
    }

    if (!user) {
        return <Login />;
    }

    return <Dashboard user={user} />;
}

export default App;
