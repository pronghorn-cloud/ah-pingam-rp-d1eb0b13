import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

function ApplicationsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <p>No application data available</p>
      </div>
    );
  }

  const colors = [
    'rgba(26, 54, 93, 0.8)',
    'rgba(49, 130, 206, 0.8)',
    'rgba(56, 161, 105, 0.8)',
    'rgba(214, 158, 46, 0.8)',
    'rgba(229, 62, 62, 0.8)',
    'rgba(128, 90, 213, 0.8)',
    'rgba(237, 137, 54, 0.8)',
    'rgba(72, 187, 120, 0.8)'
  ];

  const chartData = {
    labels: data.map(d => d.application),
    datasets: [
      {
        data: data.map(d => d.total_events),
        backgroundColor: colors.slice(0, data.length),
        borderColor: colors.slice(0, data.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2,
        hoverOffset: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: {
            size: 11,
            family: "'Inter', sans-serif"
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 32, 44, 0.95)',
        titleFont: {
          size: 13,
          family: "'Inter', sans-serif"
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const item = data[context.dataIndex];
            return [
              ` Total: ${item.total_events}`,
              ` Success: ${item.success_count}`,
              ` Failed: ${item.failure_count}`
            ];
          }
        }
      }
    },
    cutout: '60%'
  };

  return <Doughnut data={chartData} options={options} />;
}

export default ApplicationsChart;
