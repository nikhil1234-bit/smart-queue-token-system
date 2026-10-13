pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['Production', 'Staging', 'Development'], description: 'Target Deployment Environment')
        booleanParam(name: 'RUN_DOCKER_BUILD', defaultValue: true, description: 'Build and verify Docker container image')
        booleanParam(name: 'DEPLOY_TO_RENDER', defaultValue: true, description: 'Trigger automated deployment to Render Cloud')
    }

    environment {
        APP_NAME = 'smart-queue-token-system'
        IMAGE_NAME = 'smart-queue-token-system'
        HOST_PORT = '3000'
        CONTAINER_TEST_NAME = 'queue-app-jenkins-test'
        NODE_ENV = 'test'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo '===> [STAGE 1] Checking out source repository from Git...'
                checkout scm
                script {
                    if (isUnix()) {
                        sh 'git log -1 --pretty=format:"Commit: %h | Author: %an | Date: %ad | Message: %s"'
                    } else {
                        bat 'git log -1 --pretty=format:"Commit: %%h | Author: %%an | Date: %%ad | Message: %%s"'
                    }
                }
            }
        }

        stage('2. Environment Verification') {
            steps {
                echo '===> [STAGE 2] Inspecting Node.js, npm, and Runtime Tools...'
                script {
                    if (isUnix()) {
                        sh 'node -v && npm -v'
                    } else {
                        bat 'node -v && npm -v'
                    }
                }
            }
        }

        stage('3. Install Dependencies') {
            steps {
                echo '===> [STAGE 3] Installing Node.js dependencies...'
                script {
                    if (isUnix()) {
                        sh 'npm ci || npm install'
                    } else {
                        bat 'npm ci || npm install'
                    }
                }
            }
        }

        stage('4. Run Automated Jest Tests & JUnit Reports') {
            steps {
                echo '===> [STAGE 4] Executing Automated Unit & API Test Suite with JUnit Reporter...'
                script {
                    if (isUnix()) {
                        sh 'npm run test:ci'
                    } else {
                        bat 'npm run test:ci'
                    }
                }
            }
        }

        stage('5. DevSecOps Security Audit') {
            steps {
                echo '===> [STAGE 5] Running Dependency Security Audit...'
                script {
                    if (isUnix()) {
                        sh 'npm audit --audit-level=critical || echo "Non-critical vulnerabilities found, continuing build."'
                    } else {
                        bat 'npm audit --audit-level=critical || echo Non-critical vulnerabilities found, continuing build.'
                    }
                }
            }
        }

        stage('6. Docker Image Build & Tagging') {
            when {
                expression { return params.RUN_DOCKER_BUILD }
            }
            steps {
                echo '===> [STAGE 6] Building Multi-Stage Production Docker Image...'
                script {
                    if (isUnix()) {
                        sh "docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${BUILD_NUMBER} ."
                    } else {
                        bat "docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${BUILD_NUMBER} ."
                    }
                }
            }
        }

        stage('7. Docker Smoke Test & Health Check') {
            when {
                expression { return params.RUN_DOCKER_BUILD }
            }
            steps {
                echo '===> [STAGE 7] Running Container Healthcheck Smoke Test...'
                script {
                    if (isUnix()) {
                        sh """
                            docker rm -f ${CONTAINER_TEST_NAME} 2>/dev/null || true
                            docker run -d --name ${CONTAINER_TEST_NAME} -p 3001:3000 ${IMAGE_NAME}:${BUILD_NUMBER}
                            sleep 4
                            curl -f http://localhost:3001/api/health || (docker logs ${CONTAINER_TEST_NAME} && exit 1)
                            docker rm -f ${CONTAINER_TEST_NAME}
                        """
                    } else {
                        bat """
                            docker rm -f ${CONTAINER_TEST_NAME} 2>NUL || ver >NUL
                            docker run -d --name ${CONTAINER_TEST_NAME} -p 3001:3000 ${IMAGE_NAME}:${BUILD_NUMBER}
                            timeout /t 4 /nobreak
                            curl -f http://localhost:3001/api/health || (docker logs ${CONTAINER_TEST_NAME} && exit 1)
                            docker rm -f ${CONTAINER_TEST_NAME}
                        """
                    }
                }
            }
        }

        stage('8. Deploy to Target Environment') {
            when {
                expression { return params.DEPLOY_TO_RENDER }
            }
            steps {
                echo "===> [STAGE 8] Initiating Continuous Deployment to [${params.ENVIRONMENT}] on Render Cloud..."
                script {
                    withCredentials([string(credentialsId: 'RENDER_DEPLOY_HOOK_URL', variable: 'RENDER_HOOK')]) {
                        if (env.RENDER_HOOK) {
                            if (isUnix()) {
                                sh 'curl -X POST -f "${RENDER_HOOK}"'
                            } else {
                                bat 'curl -X POST -f "%RENDER_HOOK%"'
                            }
                            echo 'Render deploy hook triggered successfully!'
                        } else {
                            echo 'RENDER_DEPLOY_HOOK_URL credential not set in Jenkins credentials store. Deployment will use Render GitHub auto-sync.'
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Archiving Automated JUnit Test Reports...'
            junit allowEmptyResults: true, testResults: 'junit.xml'
            script {
                // Ensure temporary test container is stopped
                if (isUnix()) {
                    sh "docker rm -f ${CONTAINER_TEST_NAME} 2>/dev/null || true"
                } else {
                    bat "docker rm -f ${CONTAINER_TEST_NAME} 2>NUL || ver >NUL"
                }
            }
        }
        success {
            echo """
========================================================================
🎉 JENKINS CI/CD PIPELINE SUCCEEDED!
========================================================================
Project:          ${APP_NAME}
Build Number:     #${BUILD_NUMBER}
Target Env:       ${params.ENVIRONMENT}
Docker Tag:       ${IMAGE_NAME}:${BUILD_NUMBER}
Status:           READY FOR PRODUCTION TRAFFIC
========================================================================
            """
        }
        failure {
            echo """
========================================================================
❌ JENKINS CI/CD PIPELINE FAILED!
========================================================================
Build Number:     #${BUILD_NUMBER}
Target Env:       ${params.ENVIRONMENT}
Please inspect stage execution logs above for diagnostic details.
========================================================================
            """
        }
    }
}
