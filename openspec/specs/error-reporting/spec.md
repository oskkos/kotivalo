# error-reporting Specification

## Purpose
What users see when something fails unexpectedly, and how that ties to the logs: a short error reference from the page's trace id (#56).
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

