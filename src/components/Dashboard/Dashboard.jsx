import SummaryCard from "../SummaryCard/SummaryCard";
import Header from "../header/header";
import Sidebar from "../sidebar/sidebar";
import EmailList from "../EmailList/EmailList";
import EmailDetails from "../EmailDetails/EmailDetails";
import { useEffect, useState } from "react";

const API = "http://localhost:5000";

function getToken() {
    return localStorage.getItem("token");
}

function authFetch(url) {
    return fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` }
    });
}

function Dashboard({ user }) {

    const [emails, setEmails] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [loading, setLoading] = useState(false);

    // load categories on mount
    useEffect(() => {
        authFetch(`${API}/api/categories`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCategories(data);
                    // auto-select first category
                    if (data.length > 0) setSelectedCategory(data[0]);
                }
            });
    }, []);

    // load emails when selected category changes
    useEffect(() => {
        if (!selectedCategory) return;
        setLoading(true);
        authFetch(`${API}/api/emails/category/${selectedCategory._id}`)
            .then(res => res.json())
            .then(data => {
                setEmails(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [selectedCategory]);

    function handleEmailClick(email) {
        authFetch(`${API}/api/emails/${email._id}/content`)
            .then(res => res.json())
            .then(data => setSelectedEmail(data));
    }

    const summaryData = [
        { title: "Categories", value: categories.length },
        { title: "Emails", value: emails.length },
    ];

    if (loading) {
        return (
            <div className="loading">
                <h2>Loading your emails...</h2>
                <p>Our AI is organizing your inbox</p>
            </div>
        );
    }

    return (
        <div className="dashboard">

            <Header
                username={user?.name}
                profilePic={user?.profilePic}
            />

            <Sidebar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            <div className="summarySection">
                {summaryData.map(card => (
                    <SummaryCard
                        key={card.title}
                        title={card.title}
                        value={card.value}
                    />
                ))}
            </div>

            <EmailList
                emails={emails}
                onSelectEmail={handleEmailClick}
            />

            <EmailDetails email={selectedEmail} />

        </div>
    );
}

export default Dashboard;
