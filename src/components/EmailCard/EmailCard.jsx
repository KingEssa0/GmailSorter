import "./EmailCard.css";

function EmailCard({ email, onClick }) {
    const date = email.receivedDate
        ? new Date(email.receivedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";

    return (
        <div className="email-card" onClick={() => onClick(email)}>
            <div className="email-card-top">
                <span className="email-from">{email.from}</span>
                <span className="email-date">{date}</span>
            </div>
            <p className="email-subject">{email.subject}</p>
            <p className="email-summary">{email.aiSummary}</p>
        </div>
    );
}

export default EmailCard;
