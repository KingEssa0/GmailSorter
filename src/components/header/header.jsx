function Header({ profilePic, username }) {
  return (
    <div className="header">
        <h1>SmartMail AI</h1>
        <img src={profilePic || "/default-avatar.png"} alt="Profile" />
        <h2>{username}</h2>
    </div>
  );
}

export default Header;