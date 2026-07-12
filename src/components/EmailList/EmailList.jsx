import EmailCard from "../EmailCard/EmailCard";

function EmailList({ emails, onSelectEmail }) {
    return (
        <div className="emailList">
            {emails.map(email => (
                <EmailCard
                    key={email.id}
                    email={email}
                    onClick={onSelectEmail}
                />
            ))}
        </div>
    );
}

export default EmailList;