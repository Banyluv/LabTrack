// Centralised field hints for InfoTooltip components
export const HINTS = {
  // General
  search: 'Type keywords to search for a specific item by name, category, or SKU.',
  date: 'Select a date to filter records. Click the calendar icon to pick a date.',
  dateFrom: 'Filter records starting from this date (inclusive).',
  dateTo: 'Filter records up to this date (inclusive).',
  notes: 'Add any relevant comments or observations about this entry.',

  // Consumables / Inventory
  consumableSelect: 'Choose a consumable item from the list. Use the search bar to find items quickly.',
  quantity: 'Enter the number of units involved. Must be a positive number.',
  category: 'Group related consumables together for easier reporting and filtering.',
  unit: 'The measurement unit (e.g., pcs, boxes, litres) each consumable is tracked in.',
  batchNo: 'The manufacturer or supplier batch/lot number for traceability.',
  expiryDate: 'The date after which this consumable should not be used.',
  sku: 'Stock Keeping Unit — a unique identifier used internally for inventory tracking.',
  minStock: 'The minimum quantity you want to keep in stock. When stock falls below this level, it triggers a low stock alert.',
  maxStock: 'The maximum quantity you want to hold. Ordering beyond this may indicate overstocking.',
  safetyStock: 'An extra buffer above min stock to prevent stockouts during unexpected demand or supply delays.',
  emergencyOrderPoint: 'A critical threshold below which an urgent reorder is needed to avoid a stockout.',
  monthlyConsumption: 'Average quantity used per month. Used to forecast future stock needs.',
  stock: 'Current available quantity of this item in the warehouse.',
  reorderQuantity: 'The recommended quantity to order when restocking this item.',
  description: 'A brief description of the consumable, its use, or any special handling instructions.',

  // Requests
  requestingOfficer: 'The name or title of the person making this request.',
  requestNotes: 'Optional details about why this request is needed or any special instructions.',

  // Dispatch
  destination: 'The ward, department, facility, or location this stock is being sent to.',
  dispatchedBy: 'The staff member responsible for releasing the stock.',
  receivingOfficer: 'The person who will receive the stock at the destination.',
  issuedQuantity: 'The quantity actually issued to the recipient if different from the dispatch quantity.',
  returnedQuantity: 'The quantity returned unused from a previous dispatch.',

  // Receive Stock
  receivedBy: 'The staff member who received and checked the stock.',
  supplier: 'The vendor, manufacturer, or organisation that supplied the items.',
  invoiceRef: 'Invoice, waybill, or delivery note number for auditing purposes.',
  grn: 'Goods Received Note number — a document that confirms receipt of goods.',
  orderedBy: 'The person who placed the original order with the supplier.',
  approvedBy: 'The person who authorised the procurement or receipt.',
  damagedQuantity: 'Quantity found damaged or unusable upon receipt.',

  // Stock Transfer
  fromFacility: 'The source facility or warehouse where stock is being moved from.',
  toFacility: 'The destination facility that will receive the transferred stock.',
  transferredBy: 'Staff member responsible for initiating the transfer.',
  transferReceivedBy: 'Staff member at the destination who confirms receipt of the transfer.',

  // Daily Usage
  usedBy: 'The staff member who consumed or used the consumable.',
  usageDate: 'The date the consumable was actually used (not the date it was logged).',

  // Procurement
  procurementDate: 'The date the procurement order was placed.',
  procurementQuantity: 'Total quantity ordered from the supplier.',
  procurementCost: 'Total cost or unit price of the procured items.',
  procurementStatus: 'Current stage of the procurement — draft, ordered, delivered, or cancelled.',

  // Reports / Filters
  period: 'Select a reporting period — weekly, monthly, quarterly, or yearly.',
  reportType: 'Choose the type of report to generate (summary, detailed, or by category).',

  // Suppliers
  supplierName: 'The name of the vendor or supplying organisation.',
  supplierContact: 'Phone number, email, or primary contact person at the supplier.',
  supplierAddress: 'Physical or postal address of the supplier.',

  // Facilities
  facilityName: 'The name of the facility, ward, or department.',
  facilityType: 'The type or classification of the facility (e.g., hospital, clinic, warehouse).',
  facilityLocation: 'The geographic location or address of the facility.',

  // User management
  userRole: 'Determines what actions this user can perform — admin, staff, or viewer.',
  userEmail: 'The email address used for login and notifications.',
  userName: 'Full name of the user for display and record-keeping.',
  password: 'Must be at least 8 characters with a mix of letters, numbers, and symbols.',
};
