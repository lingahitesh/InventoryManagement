# Requirements Document

## Introduction

This feature adds a login page and a complete customer management page to the inventory management system React frontend. The login page serves as the entry point to the application, gating access to the home page. The customer management page displays customer records in a table/database-record structure with inline modify and delete capabilities. No backend API integration is required at this stage — all data is managed in local component state.

## Glossary

- **Login_Page**: The initial page displayed when the application loads, requiring credentials before granting access to the system.
- **Home_Page**: Loads the home page showcasing the list of inventory items along with features like inventory feeding, invemtory retrieval, place order and customer page.
- **Inventory_Feeding**: This page is used to add items to the inventory based on requirements.
- **Inventory_Retrieval**: This page is used to retrieve records based on certain inputs.
- **Place_Order**: This page allows us to place orders with regard to the items in inventory and also updating the inventory simultaneously by choosing a customer from the list of customers in customer_page.
- **Customer_Page**: The page that displays all customer records in a tabular format and provides actions to modify or delete entries.
- **Customer_Record**: A single row in the customer table representing one customer's data (e.g., name, email, phone, address).
- **App**: The root React component that manages routing, tab state, and authentication state.
- **Customer_Table**: The table component within the Customer_Page that renders customer records in rows and columns.

## Requirements

### Requirement 1: Login Page Display

**User Story:** As a user, I want to see a login page when I open the application, so that I can authenticate before accessing the system.

#### Acceptance Criteria

1. WHEN the application loads, THE App SHALL render the Login_Page as the initial view.
2. THE Login_Page SHALL display a username input field with a maximum length of 50 characters, a password input field with a maximum length of 128 characters, and a submit button.
3. THE Login_Page SHALL mask the password input field so that entered characters are not visible as plain text.
4. WHILE the user is not authenticated, THE App SHALL keep the Login_Page displayed and SHALL NOT render the Home page or any other page content.
5. WHILE the user is not authenticated, IF the user attempts to access any page other than the Login_Page, THEN THE App SHALL redirect the user back to the Login_Page.

### Requirement 2: Login Authentication (Frontend Only)

**User Story:** As a user, I want to submit my credentials on the login page, so that I can gain access to the home page.

#### Acceptance Criteria

1. THE App SHALL display the Login_Page as the initial view when no user is authenticated, presenting a username text input field, a password input field, and a submit button.
2. WHEN the user submits valid credentials (username: "admin", password: "admin") on the Login_Page, THE App SHALL navigate the user to the Home page within 1 second.
3. WHEN the user submits the login form with an empty username field or an empty password field, THE Login_Page SHALL display a validation error message adjacent to the empty field indicating that the field is required, without attempting credential validation.
4. IF the user submits non-empty credentials that do not match the valid credentials, THEN THE Login_Page SHALL display an error message indicating authentication failure and SHALL retain the entered username value in the username field.
5. WHILE the Login_Page is displayed, THE App SHALL prevent access to the Home page or any other application view until valid credentials are submitted.

### Requirement 3: Logout

**User Story:** As a user, I want to log out from the system, so that I can end my session and return to the login page.

#### Acceptance Criteria

1. THE Home page SHALL display a LogOut button that is visible and accessible to the user at all times while on the Home page.
2. WHEN the user clicks the LogOut button on the Home page, THE App SHALL clear the authentication state and navigate back to the Login_Page.
3. WHEN the user logs out, THE App SHALL reset the tab state to a single Home tab with no other tabs open and discard any unsaved form data from previously open tabs.

### Requirement 4: Customer Page Table Display

**User Story:** As a user, I want to see all customer records displayed in a table format, so that I can view and manage customer data easily.

#### Acceptance Criteria

1. WHEN the user navigates to the Customer_Page, THE Customer_Table SHALL retrieve and display all customer records in a tabular row-and-column format within 3 seconds of page load.
2. THE Customer_Table SHALL display columns in the following order from left to right: customer name, email, phone number, address and gst number. It would also be preferred to generate a unique ID for each customer for easier retrieval and management so diplay an ID too.
3. THE Customer_Table SHALL display one Customer_Record per row.
4. WHEN no customer records exist, THE Customer_Table SHALL display a message indicating that no records are available.
5. WHILE customer records are being retrieved, THE Customer_Table SHALL display a loading indicator.
6. IF the retrieval of customer records fails, THEN THE Customer_Table SHALL display a message indicating that records could not be loaded.

### Requirement 5: Add Customer Record

**User Story:** As a user, I want to add new customer records, so that I can grow the customer database.

#### Acceptance Criteria

1. THE Customer_Page SHALL provide an "Add Customer" button or form with input fields for customer name, email, phone number, address and gst.
2. WHEN the user submits a new customer with all required fields (name, email, phone number, address and gst) filled with at least 1 character each, THE Customer_Table SHALL add the new Customer_Record and display it as a new row in the table.
3. WHEN the user submits a new customer with one or more required fields empty, THE Customer_Page SHALL display a validation error message indicating which fields are missing.
4. IF the form submission fails validation, THEN THE Customer_Page SHALL retain all previously entered field values in the form.
5. THE Customer_Page SHALL limit each input field to a maximum of 100 characters.

### Requirement 6: Modify Customer Record

**User Story:** As a user, I want to modify existing customer records, so that I can keep customer information up to date.

#### Acceptance Criteria

1. THE Customer_Table SHALL provide a modify/edit action for each Customer_Record row.
2. WHEN the user clicks the modify action on a Customer_Record, THE Customer_Page SHALL display editable input fields for customer name, email, phone number, and address, pre-filled with the existing record data.
3. WHEN the user clicks the save action after modifying data with all required fields filled, THE Customer_Table SHALL update the corresponding Customer_Record with the new values and return to the normal table view.
4. WHEN the user cancels the modify operation, THE Customer_Page SHALL discard changes and return to the normal table view without altering the Customer_Record.
5. IF the user submits modified data with any required field empty, THEN THE Customer_Page SHALL display a validation error message indicating the missing fields and SHALL NOT update the Customer_Record.

### Requirement 7: Delete Customer Record

**User Story:** As a user, I want to delete customer records, so that I can remove outdated or incorrect entries.

#### Acceptance Criteria

1. THE Customer_Table SHALL provide a delete action for each Customer_Record row.
2. WHEN the user clicks the delete action on a Customer_Record, THE Customer_Page SHALL display a confirmation prompt that identifies the Customer_Record name before deletion.
3. WHEN the user confirms deletion and the operation succeeds, THE Customer_Table SHALL remove the Customer_Record from the table and display a success message within 2 seconds.
4. WHEN the user cancels deletion, THE Customer_Table SHALL retain the Customer_Record unchanged and close the confirmation prompt.
5. IF the deletion operation fails, THEN THE Customer_Page SHALL display an error message indicating the reason for failure and SHALL retain the Customer_Record unchanged in the table.

### Requirement 8: Customer Data Persistence in State

**User Story:** As a user, I want customer data to persist during my session, so that changes I make are reflected across the application until I refresh.

#### Acceptance Criteria

1. THE App SHALL maintain customer records in component state that survives tab navigation, persisting until the user refreshes or closes the browser tab.
2. WHEN the user navigates away from the Customer_Page by switching to another tab and then returns, THE Customer_Table SHALL display the same records with identical field values and row count that were present before navigation.
3. WHEN a customer record is added, modified, or deleted, THE App SHALL update the in-memory customer state immediately so that subsequent navigations to the Customer_Page reflect the change.
4. IF the user refreshes the browser page, THEN THE App SHALL reset customer state to its initial empty state, and the Customer_Table SHALL display no records.

### Requirement 9: Add a plus symbol next to each option in the home page

**User Story:** As a user, It would look good next to the options of retrieval feeding and all

#### Acceptance Criteria
Figure it out bro