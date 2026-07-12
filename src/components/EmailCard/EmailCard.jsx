function EmailCard({ email, onClick }) {
    return (
        <div className="emailCard" onClick={() => onClick(email)}>
            <h3>{email.subject}</h3>

            <p>From: {email.from}</p>

            <p>{email.aiSummary}</p>
        </div>
    );
    if (emails.length === 0) {
    return <p>No emails to display.</p>;
}
}

export default EmailCard;
