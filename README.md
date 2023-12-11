# iac-pulumi

# Pulumi Installation and setup

- To install pulumi, use command brew install pulumi
- pulumi version , to check pulumi version after installation
- Go to the project directory and provide command pulumi new. This will prompt to choose the stack for the preferred programming language. Set passphrase to access pulumi

To set region from command line for aws, pulumi config set aws:region <region_name>

To run pulumi

- pulumi up command, to run pulumi. After this command, will be prompted to enter the secrect passphrase for pulumi.
- Check in console whether the VPC is created or not
- pulumi up,to update the existing code
- To destroy created resources , give pulumi destroy
- Lambda function code available in serverless repository url: https://github.com/VNHarishKumar/serverless

Certificate Upload command

aws acm import-certificate \
  --certificate fileb:///Users/harish/Downloads/demo_harishkumarvn.me/demo_harishkumarvn_me.crt \        {your certificate file path}
  --private-key fileb:///Users/harish/Downloads/demo_harishkumarvn.me/privatekey.pem \    {your certificate private-key file path}
  --certificate-chain fileb:///Users/harish/Downloads/demo_harishkumarvn.me/demo_harishkumarvn_me.ca-bundle \   {your certificate certificate-chain file path}
