import "./EmailDetails.css";

function EmailDetails({ email }) {

    if (!email) {
        return (
            <div className="email-details">
                <div className="email-details-empty">
                    <h3>Select an email</h3>
                    <p>Click any email to read it here</p>
                </div>
            </div>
        );
    }

    const body = email.content || email.body || "";
    const isHtml = body.trim().startsWith("<") || body.includes("<html") || body.includes("<div");

    return (
        <div className="email-details">

            <div className="email-details-meta">
                <h2 className="email-details-subject">{email.subject}</h2>
                <p className="email-details-from">{email.from}</p>
                {email.receivedDate && (
                    <p className="email-details-date">
                        {new Date(email.receivedDate).toLocaleString("en-US", {
                            month: "long", day: "numeric", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                        })}
                    </p>
                )}
            </div>

            {email.aiSummary && (
                <div className="email-details-summary">
                    <p className="email-details-summary-label">Summary</p>
                    <p>{email.aiSummary}</p>
                </div>
            )}

            <hr className="email-details-divider" />

            {isHtml ? (
                <iframe
                    className="email-details-iframe"
                    srcDoc={body}
                    sandbox="allow-same-origin"
                    title="Email content"
                />
            ) : (
                <p className="email-details-body">{body}</p>
            )}

        </div>
    );
}

export default EmailDetails;
