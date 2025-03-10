import pandas as pd
import json
from datetime import datetime
import os

def process_data():
    """Process the CSV data and create a JSON file for the dashboard"""
    # Read the CSV file
    csv_path = 'police_brutality_protests.csv'
    df = pd.read_csv(csv_path)
    
    # Convert date to datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # Create daily protest counts
    daily_counts = df.groupby('date').size().reset_index()
    daily_counts.columns = ['date', 'count']
    daily_counts['date'] = daily_counts['date'].dt.strftime('%Y-%m-%d')
    
    # Create a sample of the data for the table view
    # Select relevant columns
    table_data = df[['date', 'locality', 'state', 'type', 'claims', 'size_mean']].copy()
    
    # Format date
    table_data['date'] = table_data['date'].dt.strftime('%Y-%m-%d')
    
    # Handle missing values
    table_data['size_mean'] = table_data['size_mean'].fillna('Unknown')
    
    # Convert to records
    table_records = table_data.head(1000).to_dict('records')
    
    # Create the output data structure
    output_data = {
        'daily_counts': daily_counts.to_dict('records'),
        'table_data': table_records,
        'total_protests': len(df),
        'date_range': {
            'start': df['date'].min().strftime('%Y-%m-%d'),
            'end': df['date'].max().strftime('%Y-%m-%d')
        },
        'top_states': df['state'].value_counts().head(5).to_dict(),
        'top_localities': df['locality'].value_counts().head(5).to_dict()
    }
    
    # Write to JSON file
    with open('static/data.json', 'w') as f:
        json.dump(output_data, f)
    
    print(f"Data processed successfully. {len(df)} protests analyzed.")
    return output_data

if __name__ == "__main__":
    # Create static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    process_data()
