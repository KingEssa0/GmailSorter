import SummaryCard from "./SummaryCard";
import Header from "./Header";
import Sidebar from "./Sidebar";
import EmailList from "./EmailList";
import EmailDetails from "./EmailDetails";
import { useState } from "react";

function Dashboard() {

    const [selectedEmail, setSelectedEmail] = useState(null);

    const emails = [
        {
            id: 1,
            subject: "Science Project",
            from: "teacher@school.org",
            aiSummary: "Project due Thursday.",
            body: "Hello class,\n\nThe science project is due Thursday."
        },
        {
            id: 2,
            subject: "Meeting",
            from: "alex@gmail.com",
            aiSummary: "Alex wants to meet Friday."
        }
    ];

    const summaryData = [
        {
            title: "Unread Emails",
            value: emails.length
        },
        {
            title: "Needs Reply",
            value: 5
        },
        {
            title: "Categories",
            value: 4
        }
];

    return (
        <div className="dashboard">

            <Header
                username="Bryson"
                profilePic="/default-avatar.png"
            />

            <Sidebar />

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
