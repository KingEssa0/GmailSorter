function EmailDetails({ email }) {

    if (!email) {
        return (
            <div className="emailDetails">
                <h2>Select an email</h2>
                <p>Click an email to view it.</p>
            </div>
        );
    }

    return (
        <div className="emailDetails">

            <p>
                <strong>Received:</strong>{" "}
                {new Date(email.receivedDate).toLocaleString()}
            </p>

            <h2>{email.subject}</h2>

            <p>
                <strong>From:</strong> {email.from}
            </p>

            <p>
                <strong>AI Summary:</strong>
            </p>

            <p>{email.aiSummary}</p>

            <hr />

            <h3>Email</h3>

            <p className="emailBody">{email.body}</p>

        </div>
    );
}

export default EmailDetails;