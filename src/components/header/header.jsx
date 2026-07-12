function Header({ username, profilePic }) {
  return <div class="header">
    <h1>SmartMail AI</h1>
    <img src={profilePic} alt="Profile Picture">
    <h2>{username}</h2>
  </div>
}
