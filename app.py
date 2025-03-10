import pandas as pd
import json
from datetime import datetime
import os

def process_data():
    """Process the CSV data and create a JSON file for the dashboard"""
    # Read the CSV file
    csv_path = 'police_brutality_protests.csv'
    df = pd.read_csv(csv_path, low_memory=False)
    
    # Convert date to datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # Create weekly protest counts
    df['week'] = df['date'].dt.strftime('%Y-%W')
    weekly_counts = df.groupby('week').agg(
        count=('date', 'size'),
        start_date=('date', 'min'),
        protester_count=('size_mean_imputed', 'sum')
    ).reset_index()
    weekly_counts['start_date'] = weekly_counts['start_date'].dt.strftime('%Y-%m-%d')
    
    # Create monthly protest counts
    df['month'] = df['date'].dt.strftime('%Y-%m')
    monthly_counts = df.groupby('month').size().reset_index()
    monthly_counts.columns = ['month', 'count']
    
    # Create a sample of the data for the table view
    # Select relevant columns
    table_data = df[['date', 'locality', 'state', 'type', 'claims', 'size_mean']].copy()
    
    # Format date
    table_data['date'] = table_data['date'].dt.strftime('%Y-%m-%d')
    
    # Handle missing values - impute unknown sizes with 11
    table_data['size_mean'] = table_data['size_mean'].fillna(11)
    
    # Convert to records
    table_records = table_data.head(1000).to_dict('records')
    
    # Calculate total protesters (imputing 11 for missing values)
    df['size_mean_imputed'] = df['size_mean'].fillna(11)
    total_protesters = int(df['size_mean_imputed'].sum())
    
    # Calculate daily protester counts
    daily_protester_counts = df.groupby('date').agg(
        count=('date', 'size'),
        protester_count=('size_mean_imputed', 'sum')
    ).reset_index()
    daily_protester_counts['date'] = daily_protester_counts['date'].dt.strftime('%Y-%m-%d')
    
    # Create the output data structure
    output_data = {
        'weekly_counts': weekly_counts.to_dict('records'),
        'daily_protester_counts': daily_protester_counts.to_dict('records'),
        'monthly_counts': monthly_counts.to_dict('records'),
        'table_data': table_records,
        'total_protests': len(df),
        'total_protesters': total_protesters,
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
