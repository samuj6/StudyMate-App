# StudyMate-App

StudyMate is an exam planner with account authentication and saved planner profiles.

## MySQL setup

1. Copy `.env.example` to `.env`.
2. Replace `DB_PASSWORD` with the password for your local MySQL user.
3. Optionally replace `JWT_SECRET` with a long random value.
4. Start the app:

```powershell
npm start
```

The server creates the `studymate` database and its `users` and `planner_profiles` tables automatically. You can also run `schema.sql` in MySQL Workbench to create them manually.

Open `http://localhost:3000` after the server starts.

The API stores password hashes, never plain-text passwords. The planner API requires the JWT returned by registration or login.
