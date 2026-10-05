pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out latest code from GitHub...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building Smart Parking Docker Image...'
                sh 'docker build -t smart-parking-ci .'
            }
        }

        stage('Run Automated Pytest') {
            steps {
                echo 'Running Pytest automated test cases...'
                sh 'docker run --rm smart-parking-ci python -m pytest test_app.py'
            }
        }

        stage('Ansible Deployment') {
            steps {
                echo 'Triggering Ansible Playbook deployment...'
                sh 'docker exec ansible-docker-lab ansible-playbook -i /inventory.ini /docker-deploy.yml'
            }
        }
    }

    post {
        success {
            echo 'Smart Parking CI/CD Pipeline Completed Successfully!'
        }
        failure {
            echo 'CI/CD Pipeline Execution Failed.'
        }
    }
}
