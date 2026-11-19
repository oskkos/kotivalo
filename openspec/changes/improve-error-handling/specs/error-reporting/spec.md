## ADDED Requirements

### Requirement: Telling the user when the connection fails
When a request fails because it never reached the server (no connection, or the request was cancelled), the user SHALL see that there is no connection and to check it and try again, without an error reference. The browser SHALL log the failure as a warning, not an error, so it does not raise an alert.

#### Scenario: A request without a connection shows a connection message
- **WHEN** a visitor on `/sign-in` sends a code request while the browser is offline
- **THEN** they stay on the email step and see that there is no connection, without `Virhetunnus:`

#### Scenario: A page that cannot load without a connection shows a connection message
- **WHEN** a signed-in user on `/properties/new` loses the connection and closes the form, so the flats list cannot load
- **THEN** the page shows that there is no connection, without `Virhetunnus:`

#### Scenario: A connection failure is logged as a warning
- **WHEN** the browser logs a failure whose error is a `TypeError` "Failed to fetch"
- **THEN** the line is sent at `warn` with `network: true`, not at `error`

### Requirement: Showing that a page was not found
An address that matches no page SHALL show, in the user's language, that the page was not found, with a link to the home page, and respond with status 404.

#### Scenario: An unknown address shows that the page was not found
- **WHEN** a visitor opens `/no-such-page`
- **THEN** the response status is 404 and the page shows that the page was not found, with a link to `/`
