import { useEffect, useState } from "react";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";

const API = "http://localhost:5000";

function App() {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // grab token from URL if we just came back from OAuth
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
            localStorage.setItem("token", urlToken);
            // clean token out of URL
            window.history.replaceState({}, "", window.location.pathname);
        }

        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }

        fetch(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => {
            if (!res.ok) {
                localStorage.removeItem("token");
                return null;
            }
            return res.json();
        })
        .then(data => {
            setUser(data);
            setLoading(false);
        })
        .catch(() => setLoading(false));

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
