import "./header.css";

function Header({ profilePic, username }) {
    return (
        <header className="header">
            <div className="header-logo">
                <img src="/favicon.svg" alt="SmartMail AI" className="header-logo-img" />
                <span className="header-logo-text">SmartMail AI</span>
            </div>
            <div className="header-user">
                <img
                    className="header-avatar"
                    src={profilePic || null}
                    alt=""
                    onError={e => { e.target.style.display = "none"; }}
                />
                <span className="header-username">{username}</span>
            </div>
        </header>
    );
}

export default Header;
