// import { submitForm } from "../actions/submitForm";
import { submitForm } from "../server.action";

export default function Page() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Contact Form</h1>

      <form action={submitForm}>
        <div>
          <input
            type="text"
            name="name"
            placeholder="Name"
            required
          />
        </div>

        <div>
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
          />
        </div>

        <div>
          <textarea
            name="content"
            placeholder="Message"
            required
          />
        </div>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
// documentation oP iN thE chaT