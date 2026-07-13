import "./Dashboard.css";
import SummaryCard from "../SummaryCard/SummaryCard";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import EmailList from "../EmailList/EmailList";
import EmailDetails from "../EmailDetails/EmailDetails";
import { useEffect, useState } from "react";

const API = "http://localhost:5000";

function getToken() {
    return localStorage.getItem("token");
}

function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
            ...options.headers,
        }
    });
}

function Dashboard({ user }) {

    const [emails, setEmails] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState("");
    const [newCatName, setNewCatName] = useState("");
    const [newCatDesc, setNewCatDesc] = useState("");
    const [catLoading, setCatLoading] = useState(false);

    useEffect(() => {
        authFetch(`${API}/api/categories`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setCategories(data);
                    if (data.length > 0) setSelectedCategory(data[0]);
                }
            });
    }, []);

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

    function handleCreateCategory(e) {
        e.preventDefault();
        if (!newCatName.trim() || !newCatDesc.trim()) return;
        setCatLoading(true);
        authFetch(`${API}/api/categories`, {
            method: "POST",
            body: JSON.stringify({ name: newCatName.trim(), description: newCatDesc.trim() })
        })
        .then(res => res.json())
        .then(cat => {
            setCategories(prev => [...prev, cat]);
            setSelectedCategory(cat);
            setNewCatName("");
            setNewCatDesc("");
            setCatLoading(false);
        })
        .catch(() => setCatLoading(false));
    }

    function handleDeleteCategory(catId) {
        authFetch(`${API}/api/categories/${catId}`, { method: "DELETE" })
            .then(res => res.json())
            .then(() => {
                setCategories(prev => prev.filter(c => c._id !== catId));
                if (selectedCategory?._id === catId) {
                    const remaining = categories.filter(c => c._id !== catId);
                    setSelectedCategory(remaining.length > 0 ? remaining[0] : null);
                    setEmails([]);
                }
            });
    }

    function handleSync() {
        setSyncing(true);
        setSyncMsg("");
        authFetch(`${API}/api/emails/sync`, { method: "POST", body: JSON.stringify({}) })
            .then(async res => {
                const data = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(data?.msg || `Sync failed (${res.status})`);
                }
                setSyncMsg(data?.msg || "Sync completed");
                setSyncing(false);
                authFetch(`${API}/api/categories`)
                    .then(r => r.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            setCategories(data);
                            if (selectedCategory) {
                                const updated = data.find(c => c._id === selectedCategory._id);
                                if (updated) setSelectedCategory(updated);
                            }
                        }
                    });
            })
            .catch(err => { setSyncMsg(err.message || "Sync failed"); setSyncing(false); });
    }

    const summaryData = [
        { title: "Categories", value: categories.length },
        { title: "Emails", value: emails.length },
    ];

    return (
        <div className="dashboard">

            <Header username={user?.name} profilePic={user?.profilePic} />

            <Sidebar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onDeleteCategory={handleDeleteCategory}
            />

            <main className="main-content">

                <div className="summary-section">
                    {summaryData.map(card => (
                        <SummaryCard key={card.title} title={card.title} value={card.value} />
                    ))}
                </div>

                <form className="create-category-form" onSubmit={handleCreateCategory}>
                    <label>
                        Name
                        <input
                            type="text"
                            placeholder="e.g. Newsletters"
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                        />
                    </label>
                    <label>
                        Description
                        <input
                            className="wide"
                            type="text"
                            placeholder="e.g. Marketing emails and newsletters"
                            value={newCatDesc}
                            onChange={e => setNewCatDesc(e.target.value)}
                        />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={catLoading}>
                        {catLoading ? "Creating..." : "Add Category"}
                    </button>
                </form>

                <div className="sync-bar">
                    <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                        {syncing ? "Syncing..." : "Sync Emails"}
                    </button>
                    {syncMsg && <span className="sync-msg">{syncMsg}</span>}
                </div>

                {loading ? (
                    <div className="loading-state">
                        <h3>Loading emails...</h3>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="empty-state">
                        <h3>No categories yet</h3>
                        <p>Create a category above, then sync your emails.</p>
                    </div>
                ) : (
                    <EmailList emails={emails} onSelectEmail={handleEmailClick} />
                )}

            </main>

            <EmailDetails email={selectedEmail} />

        </div>
    );
}

export default Dashboard;
