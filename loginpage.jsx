function Login() {

    function handleGoogleLogin() {
        window.location.href =
            "http://localhost:5000/api/auth/google";
    }

    return (
        <div className="login">

            <header>
                <h3>Welcome to SmartMail AI</h3>
            </header>

            <main>

                <p>
                    <b>Features:</b>
                    <br />
                    1. Sign in with Google
                    <br />
                    2. Connect multiple Gmail accounts
                    <br />
                    3. Create custom categories for sorting emails
                    <br />
                    4. AI automatically categorizes and summarizes new emails
                    <br />
                    5. One-click unsubscribe from mailing lists
                    <br />
                    6. Bulk delete emails
                </p>


                <div className="container">

                    <h4>
                        Automate your inbox with AI
                    </h4>

                    <button onClick={handleGoogleLogin}>
                        Sign in with Google
                    </button>

                </div>

            </main>


            <footer>
                <p>
                    ©2026 SmartMail AI. All rights reserved
                </p>
            </footer>

        </div>
    );
}

export default Login;
