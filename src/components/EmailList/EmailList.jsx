import EmailCard from "../EmailCard/EmailCard";
import "../EmailCard/EmailCard.css";

function EmailList({ emails, onSelectEmail }) {
    if (emails.length === 0) {
        return <p className="email-list-empty">No emails in this category yet. Try syncing.</p>;
    }

    return (
        <div className="email-list">
            {emails.map(email => (
                <EmailCard
                    key={email._id}
                    email={email}
                    onClick={onSelectEmail}
                />
            ))}
        </div>
    );
}

export default EmailList;
