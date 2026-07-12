import { useEffect, useState } from "react";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";


function App() {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {

        fetch("http://localhost:5000/api/auth/me", {
            credentials: "include"
        })
        .then(res => res.json())
        .then(data => {
            setUser(data);
            setLoading(false);
        });

    }, []);


    if (loading) {
        return <h2>Loading...</h2>;
    }


    if (!user) {
        return <Login />;
    }


    return <Dashboard />;

}

export default App;
