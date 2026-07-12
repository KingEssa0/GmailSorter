function Header({ profilePic, username }) {
  return <div className="header">
    <h1>SmartMail AI</h1>
    <img src={profilePic} alt="Profile Picture">
    <h2>{username}</h2>
  </div>
}
