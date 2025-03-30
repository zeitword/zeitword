#!/bin/bash

# --- Configuration ---
ENV_FILE="../.env"            # Path to the .env file
DSN_VAR_NAME="NUXT_DSN"    # Name of the variable in the .env file

BACKUP_DIR="../../"  # Directory to save backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="db_backup_${TIMESTAMP}.dump" # Generic filename
# --- End Configuration ---

# Check if .env file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Environment file not found at '$ENV_FILE'"
  exit 1
fi

# Read the DSN variable from the .env file
# - Use grep to find the line starting with the variable name followed by =
# - Use sed to remove the variable name and =, and potential quotes
DB_CONNECTION_STRING=$(grep "^${DSN_VAR_NAME}=" "$ENV_FILE" | sed -e "s/^${DSN_VAR_NAME}=//" -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

# Check if the variable was found and extracted
if [[ -z "$DB_CONNECTION_STRING" ]]; then
  echo "Error: Variable '$DSN_VAR_NAME' not found or empty in '$ENV_FILE'."
  exit 1
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup using DSN from '$ENV_FILE'..."

# Create the backup using pg_dump
# -Fc: Custom format (compressed, suitable for pg_restore)
# -f: Output file path
# -d: Database connection string (URI)
pg_dump -Fc -f "${BACKUP_DIR}/${FILENAME}" -d "$DB_CONNECTION_STRING"

# Check if pg_dump was successful
if [[ $? -eq 0 ]]; then
  echo "Backup successful: ${BACKUP_DIR}/${FILENAME}"
else
  echo "Error: Database backup failed."
  # Optional: Remove potentially incomplete file
  # rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

exit 0
