# error-reporting Specification

## Purpose
What users see when something fails, and how that ties to the logs: a short error reference from the page's trace id for unexpected failures (#56), a connection message (and a warning, not an alert) when a request never reaches the server, and a not-found page for unknown addresses.
## Requirements
### Requirement: Showing a reference with an unexpected error
When a request fails unexpectedly or a page fails to render, the user SHALL see that something went wrong together with a reference: the first 8 characters of the page's trace id, e.g. `Virhetunnus: 4bf92f35`. The failure SHALL be logged under that trace, so the reference finds it in the logs.

#### Scenario: A failed request shows a reference
- **WHEN** a visitor on `/sign-in` sends a code request and the server answers 500
- **THEN** they stay on the email step and see that something went wrong, with `Virhetunnus:` and the first 8 characters of the trace id their browser sent with the request

#### Scenario: A page that fails to render shows a reference
- **WHEN** rendering a page throws an error
- **THEN** the page shows that something went wrong, with the reference of the page's trace

#### Scenario: The reference finds the failure in the logs
- **WHEN** the browser logs an unexpected failure with trace id `4bf92f3577b34da6a3ce929d0e0e4736`
- **THEN** the Worker writes that line with that trace id, so a search for `4bf92f35` finds it, and the alert's reference is `4bf92f35`

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

