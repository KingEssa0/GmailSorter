import SummaryCard from "../SummaryCard/SummaryCard";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import EmailList from "../EmailList/EmailList";
import EmailDetails from "../EmailDetails/EmailDetails";
import { useEffect, useState } from "react";

function Dashboard() {

    const [selectedEmail, setSelectedEmail] = useState(null);

    useEffect(() => {

        fetch("http://localhost:5000/api/emails/category/123")
            .then(response => response.json())
            .then(data => {
            setEmails(data);
        });

    }, []);

    const [user, setUser] = useState(null);

    useEffect(() => {

        fetch("http://localhost:5000/api/auth/me")
            .then(response => response.json())
            .then(data => {
            setUser(data);
        });

    }, []);

    const [categories, setCategories] = useState([]);

    useEffect(() => {

        fetch("http://localhost:5000/api/categories")
            .then(response => response.json())
            .then(data => {
            setCategories(data);
        });

    }, []);

    function handleEmailClick(email) {

        fetch(`http://localhost:5000/api/emails/${email.id}/content`)
            .then(response => response.json())
            .then(data => {
            setSelectedEmail(data);
        });

    }

    return (
        <div className="dashboard">

            <Header
                username={user?.username}
                profilePic={user?.profilePic}
            />

            <Sidebar categories={categories} />

            <EmailDetails email={selectedEmail} />

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
                onSelectEmail={setSelectedEmail}
            />

        </div>
    );
}

export default Dashboard;
