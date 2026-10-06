# Test scenarios for Make review

Build each one in the eu1 organisation with the app installed, run it once, share it and paste the share link into the app's review form.

1. **Treatment register in a sheet.** Google Sheets › Watch New Rows (columns: field reference, date, product number, dose, unit) › Agro GPS › Get a Plant Protection Product (country ES, number from the row) › Agro GPS › Register an Operation (type Plant protection treatment, safety days = `get(first(uses); "safety_days")` of the product) › Google Sheets › Update a Row with the result.
2. **Safety interval alert.** Agro GPS › Watch Operations (Operation registered) › Agro GPS › Make an API Call (GET `/api/v1/sync/records?farm_id={{farm_id}}`) › Filter: entry type treatment › Email › Send an Email «do not harvest before …».
3. **Fields to a cooperative.** Schedule (weekly) › Agro GPS › List Farms › Agro GPS › List Fields › Google Sheets › Add a Row (name, reference, crop, surface).
4. **Product lookup.** Google Sheets › Watch New Rows (product name, country) › Agro GPS › Search Plant Protection Products › Google Sheets › Add a Row (registration number, holder, register).
