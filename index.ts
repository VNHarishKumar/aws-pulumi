import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Ipv4 } from "@pulumi/aws/alb";


const config = new pulumi.Config("myVpc");

const cidrBlock = config.require("cidrBlock");


// const cidrBlock = config.require("cidrBlock");

// const [baseFirst, baseSecond] = cidrBlock.split('.').slice(0, 2);

const vpcName = config.require("vpcName");
const publicSub = config.require("publicSubnet");
const privateSub = config.require("privateSubnet");
const intGateWay = config.require("intGateWay");
const publicRoute = config.require("publicRoute");
const prviateRoute = config.require("privateRoute");
const destinationCidrBlockconfig = config.require("destinationCidrBlockcon");
const publicKeyGen = config.require("publickeygen");
const mpswd = config.require("mpswd");
const uname = config.require("uname");
const dbname = config.require("dbname");
const iclass = config.require("iclass");
const eversion = config.require("eversion");
const eng  = config.require("eng");
const idenf = config.require("idenf");

const amiId = config.require("amiid");
const instanceType = config.require("itype");
const keyPairName = new aws.ec2.KeyPair("my-key-pair", {
    publicKey: publicKeyGen,
});


// Base CIDR block
const baseCidrBlock = cidrBlock;

// Function to calculate the new subnet mask
function calculateNewSubnetMask(vpcMask: number, numSubnets: number): number {
    const bitsNeeded = Math.ceil(Math.log2(numSubnets));
    const newSubnetMask = vpcMask + bitsNeeded;
    return newSubnetMask;
}

function ipToInt(ip: string): number {
    const octets = ip.split('.').map(Number);
    return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function intToIp(int: number): string {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

function generateSubnetCidrBlocks(baseCidrBlock: string, numSubnets: number): string[] {
    const [baseIp, vpcMask] = baseCidrBlock.split('/');
    const newSubnetMask = calculateNewSubnetMask(Number(vpcMask), numSubnets);
    const subnetSize = Math.pow(2, 32 - newSubnetMask);
    const subnetCidrBlocks = [];
    for (let i = 0; i < numSubnets; i++) {
        const subnetIpInt = ipToInt(baseIp) + i * subnetSize;
        const subnetIp = intToIp(subnetIpInt);
        subnetCidrBlocks.push(`${subnetIp}/${newSubnetMask}`);
    }
    return subnetCidrBlocks;
}


const vpc = new aws.ec2.Vpc(vpcName, {
    cidrBlock:baseCidrBlock,
    enableDnsSupport: true,
    enableDnsHostnames: true,
    tags:{
        Name:vpcName,
    },
});


const azs = aws.getAvailabilityZones({ state: "available" }).then(result => result.names);

const publicSubnets: aws.ec2.Subnet[] = [];
const privateSubnets: aws.ec2.Subnet[] = [];

const randomAZs = pulumi.all([azs]).apply(([azList]) => {
    // Shuffle the available AZs randomly
    const shuffledAZs = azList.slice().sort(() => 0.5 - Math.random());
    // Select up to three AZs, or all available AZs if there are fewer than three
    return shuffledAZs.slice(0, Math.min(3, shuffledAZs.length));
});


const subnetCidrBlocks = generateSubnetCidrBlocks(baseCidrBlock, 6); 


randomAZs.apply(azList => {
    for (let i = 0; i < azList.length; i++) {
        const az = azList[i];

        // Create subnets in each of the specified AZs
        const publicSubnet = new aws.ec2.Subnet(`${publicSub}-${az}`, {
            vpcId: vpc.id,
            cidrBlock:  subnetCidrBlocks[i],       
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags:{
                Name:`${publicSub}-${az}`,
            },
        });

        const privateSubnet = new aws.ec2.Subnet(`${privateSub}-${az}`, {
            vpcId: vpc.id,
            cidrBlock: subnetCidrBlocks[3+i],
            availabilityZone: az,
            tags:{
                Name:`${privateSub}-${az}`,
            },
        });

        publicSubnets.push(publicSubnet);
        privateSubnets.push(privateSubnet);

       
    }
    // console.log(publicSubnets);
// const amiId = config.require("amiid");
// const instanceType = 't2.micro';
// const keyPairName = new aws.ec2.KeyPair("my-key-pair", {
//     publicKey: publicKeyGen,
// });


// Create a security group for the ALB
const albSecurityGroup: aws.ec2.SecurityGroup = new aws.ec2.SecurityGroup("albSecurityGroup", {
    vpcId: vpc.id, // Specify your VPC ID
    ingress:[ {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        // cidrBlocks: ["0.0.0.0/0"], // Allow HTTP from anywhere (for demo purposes)
        cidrBlocks: [destinationCidrBlockconfig],
    },
    {
        protocol: "tcp",
        fromPort: 443,
        toPort: 443,
        // cidrBlocks: ["0.0.0.0/0"], // Allow HTTPS from anywhere (for demo purposes)
        cidrBlocks: [destinationCidrBlockconfig],
    },],
    egress: [{ 
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
    }],
});


const rdsSecurityGroup = new aws.ec2.SecurityGroup("database-security-group", {
    vpcId: vpc.id,
    description: "RDS Security Group",
});


// ---------------------------------------------------Instance Security Group-------------------------

const securityGroup = new aws.ec2.SecurityGroup("mySecurityGroup", {
    vpcId: vpc.id,
    description: "My security group description",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: [destinationCidrBlockconfig],
            // securityGroups: [albSecurityGroup.id],
        },
        {
            protocol: "tcp",
            fromPort: 9000, 
            toPort: 9000,   
            // cidrBlocks: ["0.0.0.0/0"], // Allow your custom application port from anywhere
            // Remove if didn't work
            // cidrBlocks: [destinationCidrBlockconfig],
            securityGroups: [albSecurityGroup.id],
        },
        
    ],
    egress: [
        {
          fromPort: 3306,
          toPort: 3306,
          protocol: "tcp",
        //   cidrBlocks: ["0.0.0.0/0"],
          cidrBlocks: [destinationCidrBlockconfig],
        // securityGroups: [rdsSecurityGroup.id,albSecurityGroup.id],
        },
      ],
      tags: {
        Name: "applicationSecurityGroup",
      },
});

// ------------------------------------------ DB SECURITY CODE ----------------------------------------------

// parameter group
const rdsParameterGroup = new aws.rds.ParameterGroup("my-rds-parameter-group", {
    // family: "mariadb10.5", // Specify the MariaDB version that matches your instance
    family:  "mariadb10.6",
    parameters: [
        {
            name: "character_set_server",
            value: "utf8", // Set your desired character set
        },
        {
            name: "character_set_client",
            value: "utf8", // Set your desired collation
        },
        {
            name: "max_connections",  // Add the max_connections parameter
            value: "100", // Set your desired maximum connections value
        },
        // Add more custom parameters as needed
    ],
});

// Create an RDS security group
// const rdsSecurityGroup = new aws.ec2.SecurityGroup("database-security-group", {
//     vpcId: vpc.id,
//     description: "RDS Security Group",
// });

// Create an inbound security group rule for RDS
const rdsInboundSecurityGroupRule = new aws.ec2.SecurityGroupRule("rds-inbound-rule", {
    type: "ingress",
    fromPort: 3306, // MySQL port
    toPort: 3306,
    // fromPort: 0, // MySQL port
    // toPort: 65535,
    protocol: "tcp",
    securityGroupId: rdsSecurityGroup.id, // Your EC2 instance's security group
    // securityGroupId: securityGroup.id,
    // sourceSecurityGroupId: rdsSecurityGroup.id, // Your RDS security group
    sourceSecurityGroupId:securityGroup.id ,  // provide the application security id
 });

// Create an outbound security group rule for RDS
const rdsOutboundSecurityGroupRule = new aws.ec2.SecurityGroupRule("rds-outbound-rule", {
    type: "egress",
    fromPort: 0,
    toPort: 65535,
    protocol: "tcp",
    securityGroupId: rdsSecurityGroup.id, // Your RDS security group
    // cidrBlocks: ["0.0.0.0/0"], // Allow outbound traffic to anywhere (adjust as needed)
    cidrBlocks: [destinationCidrBlockconfig],
});


// Create subnets for the RDS instance
const rdsSubnets = new aws.rds.SubnetGroup("my-rds-subnets", {
    subnetIds: [privateSubnets[0].id, privateSubnets[1].id], //  // subnetIds: [publicSubnets[0].id, publicSubnets[1].id],
    description: "RDS Subnet Group",
});

// Create an RDS instance
const rdsInstance = new aws.rds.Instance("my-rds-instance", {
    allocatedStorage: 10, // Adjust the storage size as needed
    // storageType: "gp2", // EBS storage type
    engine: eng,
    engineVersion: eversion,
    // engineVersion: "10.11.4",
    instanceClass: iclass, // Adjust the instance class as needed
    identifier:idenf,
    dbName: dbname,
    username: uname,
    password: mpswd,
    skipFinalSnapshot: true, // Change to false if you want a final snapshot
    vpcSecurityGroupIds: [rdsSecurityGroup.id], // Associate the RDS security group
    availabilityZone:azList[0],
    dbSubnetGroupName: rdsSubnets.name, // Specify the RDS subnet group
    publiclyAccessible: false, // Set to true if you want the RDS instance to be publicly accessible
    parameterGroupName: rdsParameterGroup.name,
  
});

// console.log("adress of rds instance",rdsInstance.address);
// console.log("address of Endpoint",rdsInstance.endpoint);
// Depend on the RDS instance for the EC2 instance
// ec2Instance.transform(() => {
//     return rdsInstance.id;
// });
// ------------------------------------------------ DB SECURITY GROUP END----------------------------------------
// ---------------
const ec2Role = new aws.iam.Role('ec2Role', {
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
                Service: "ec2.amazonaws.com"
            }
        }]
    })
});

const cloudWatchArn = config.require("arnid");
const autoScalingArn = config.require("autoscalearnid");

// Attach CloudWatch policy
const cloudWatchPolicyAttachment = aws.iam.getPolicy({
    arn: cloudWatchArn,
}).then(policy => {
    return new aws.iam.PolicyAttachment('cloudWatchPolicyAttachment', {
        policyArn: policy.arn,
        roles: [ec2Role.name],
    });
});

// Attach Auto Scaling policy
// const autoScalingPolicyAttachment = aws.iam.getPolicy({
//     arn: autoScalingArn,
// }).then(policy => {
//     return new aws.iam.PolicyAttachment('autoScalingPolicyAttachment', {
//         policyArn: policy.arn,
//         roles: [ec2Role.name],
//     });
// });

const ec2InstanceProfile = new aws.iam.InstanceProfile('ec2InstanceProfile', {
    name: 'YourInstanceProfileName', // Replace with a unique name
    role: ec2Role.name,
});

// -----------------


const dialect = 'mysql';

console.log("Instance value",rdsInstance.address);
// Create a launch configuration for the auto scaling group
// const userDataScript = `#!/bin/bash
//     sudo echo "MYSQL_HOST=${rdsInstance.address}" | sudo tee /opt/web-app/.env
//     sudo echo "MYSQL_USER='${rdsInstance.username}'" | sudo tee -a /opt/web-app/.env
//     sudo echo "MYSQL_PASSWORD='${rdsInstance.password}'" | sudo tee -a /opt/web-app/.env
//     sudo echo "MYSQL_DATABASE='${rdsInstance.dbName}'" | sudo tee -a /opt/web-app/.env
//     sudo echo "MYSQL_DIALECT='${dialect}'" | sudo tee -a /opt/web-app/.env
//     echo 'Hello from the new EC2 instance';
//     sudo /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
//     -a fetch-config \
//     -m ec2 \
//     -c file:/opt/cloudwatch-config.json \
//     -s
// `;

// const encodedUserData = pulumi.output(userDataScript).apply(data => Buffer.from(data).toString("base64"));

const userDataScript = pulumi.interpolate`#!/bin/bash
    sudo echo "MYSQL_HOST=${rdsInstance.address}" | sudo tee /opt/web-app/.env
    sudo echo "MYSQL_USER='${rdsInstance.username}'" | sudo tee -a /opt/web-app/.env
    sudo echo "MYSQL_PASSWORD='${rdsInstance.password}'" | sudo tee -a /opt/web-app/.env
    sudo echo "MYSQL_DATABASE='${rdsInstance.dbName}'" | sudo tee -a /opt/web-app/.env
    sudo echo "MYSQL_DIALECT='${dialect}'" | sudo tee -a /opt/web-app/.env
    echo 'Hello from the new EC2 instance';
    sudo /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/cloudwatch-config.json \
    -s
`;


const launchTemplate: aws.ec2.LaunchTemplate = new aws.ec2.LaunchTemplate("myLaunchTemplate", {
    imageId: amiId,
    instanceType: instanceType,
    keyName: keyPairName.keyName,
    // securityGroupNames: [securityGroup.name],
    // vpcSecurityGroupIds:[securityGroup.id],
    
    blockDeviceMappings: [
        {
            deviceName: "/dev/xvda", // This may vary depending on the AMI
            ebs: {
                volumeSize: 25,
                volumeType: 'gp2',
                deleteOnTermination: 'true',
            },
        },
        // Add more block device mappings if needed
    ],
    iamInstanceProfile: {
        arn: ec2InstanceProfile.arn,  // Corrected: Using the correct instance profile ARN
    },
    networkInterfaces:[{
        associatePublicIpAddress:"true",
        subnetId: publicSubnets[0].id,
        securityGroups: [securityGroup.id],
    }],
    // userData: encodedUserData,
    userData: pulumi.interpolate`${userDataScript.apply((s) =>
        Buffer.from(s).toString("base64")
      )}`,
    instanceInitiatedShutdownBehavior: 'stop',
    disableApiTermination: false,
    tags: {
                Name: 'MyEC2Instance',
            },
},{
    dependsOn:[rdsInstance,ec2InstanceProfile]
  });



// const ec2Instance: aws.ec2.Instance  = new aws.ec2.Instance('myEC2Instance', {
//     ami: amiId,
//     instanceType: instanceType,
//     subnetId: publicSubnets[0].id,
//     keyName: keyPairName.keyName, 
//     securityGroups: [securityGroup.id], // Associate the security group
//     availabilityZone:azList[0],
//     iamInstanceProfile: ec2InstanceProfile.name, 
//     tags: {
//         Name: 'MyEC2Instance',
//     },
// },{
//     dependsOn: [vpc,...privateSubnets,...publicSubnets],
// });





// Create an ALB
const alb: aws.lb.LoadBalancer = new aws.lb.LoadBalancer("myALB", {
    internal:false,
    loadBalancerType:"application",
    securityGroups: [albSecurityGroup.id],
    subnets: publicSubnets.map(subnet => subnet.id),
    enableDeletionProtection: false,
    ipAddressType: Ipv4,
});

// Create a target group for the ALB
const targetGroup: aws.lb.TargetGroup = new aws.lb.TargetGroup("myTargetGroup", {
    vpcId: vpc.id,
    port: 9000,
    protocol: "HTTP",
    targetType: "instance",
    // vpcId: vpc.id,
    healthCheck:{
      port: "9000",
      healthyThreshold: 2,
      interval: 30,
      path: "/healthz",
      enabled: true,
      timeout: 5,
      matcher: "200",
      unhealthyThreshold: 2,
        // timeout: 120, // Increase the timeout value to allow more time for the instance to become healthy
        // interval: 125,
        
      },
      deregistrationDelay: 500,
});



// Create an ALB listener
const albListener: aws.lb.Listener = new aws.lb.Listener("myALBListener", {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [{
        type: "forward",
        targetGroupArn: targetGroup.arn,
    }],
});

// Attach the target group to the ALB listener
// const targetGroupAttachment: aws.lb.ListenerRule = new aws.lb.ListenerRule("myTargetGroupAttachment", {
//     listenerArn: albListener.arn,
//     actions: [{
//         type: "forward",
//         targetGroupArn: targetGroup.arn,
//     }],
//     conditions: [{
//         pathPattern: {
//             values: ["/"],
//         },
//     }],
// });


// console.log("My public subnets before auto sale:",publicSubnets);
const autoScalingGroup: aws.autoscaling.Group = new aws.autoscaling.Group("myAutoScalingGroup", {
    vpcZoneIdentifiers: publicSubnets.map(subnet => subnet.id),
    desiredCapacity:1,
    minSize: 1,
    maxSize: 3,
    defaultCooldown: 60,
    healthCheckGracePeriod: 500,
    targetGroupArns:[targetGroup.arn],
    launchTemplate: {
        id: launchTemplate.id,
        // version: "$Latest", // Use the latest version of the Launch Template
    },tags: [
        {
          key: "Name",
          propagateAtLaunch: true,
          value: "Web_App_Instance",
        },
      ],
    healthCheckType: "EC2",
   
});


// -----------------------------------Scale up begin --------------------------------------

// Create Auto Scaling policies
const scaleUpPolicy = new aws.autoscaling.Policy("scale-up-policy", {
    scalingAdjustment: 1,
    metricAggregationType: 'average',
    adjustmentType: "ChangeInCapacity",
    cooldown: 70, // 5 minutes cooldown
    autoscalingGroupName: autoScalingGroup.name,
});

const scaleDownPolicy = new aws.autoscaling.Policy("scale-down-policy", {
    scalingAdjustment: -1,
    metricAggregationType: 'average',
    adjustmentType: "ChangeInCapacity",
    cooldown: 70, // 5 minutes cooldown
    autoscalingGroupName: autoScalingGroup.name,
});



// Create CloudWatch Alarms for scaling policies
const scaleUpAlarm = new aws.cloudwatch.MetricAlarm("scale-up-alarm", {
    name: "scale-up-alarm",
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: 120,
    statistic: "Average",
    threshold: 5,
    actionsEnabled: true,
    dimensions: { AutoScalingGroupName: autoScalingGroup.name },
    alarmActions: [scaleUpPolicy.arn],
});

const scaleDownAlarm = new aws.cloudwatch.MetricAlarm("scale-down-alarm", {
    name: "scale-down-alarm",
    comparisonOperator: "LessThanOrEqualToThreshold",
    evaluationPeriods: 2,
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: 120,
    statistic: "Average",
    threshold: 3,
    actionsEnabled: true,
    dimensions: { AutoScalingGroupName: autoScalingGroup.name },
    alarmActions: [scaleDownPolicy.arn],
});




// -------------------------------- Scale up end ---------------------------------


// Attach the ALB target group to the auto scaling group
const asgTargetGroupAttachment: aws.autoscaling.Attachment = new aws.autoscaling.Attachment("myASGTargetGroupAttachment", {
    autoscalingGroupName: autoScalingGroup.name,
    lbTargetGroupArn: targetGroup.arn,
});

const domainName = config.require("domainName");
const zoneid = config.require("zoneid");


const albRecord: aws.route53.Record = new aws.route53.Record("myAlbRecord", {
    zoneId: zoneid, // Specify your Route 53 hosted zone ID
    name: domainName, // The domain name you want to associate
    // name: "your-domain-name.example.com", // Replace with your desired domain name
    type: "A",
    // zoneId: "your-route53-zone-id", // Replace with your Route 53 hosted zone ID
    aliases: [{
        evaluateTargetHealth: true,
        name: alb.dnsName,
        zoneId: alb.zoneId,
    }],
});






});


// console.log(publicSubnets);


//     }
// });


const internetGateway = new aws.ec2.InternetGateway(intGateWay, {
    vpcId: vpc.id,
    tags:{
        Name:intGateWay,
    },
});

const publicRouteTable = new aws.ec2.RouteTable(publicRoute, {
    vpcId: vpc.id,
    tags:{
        Name:publicRoute,
    },
});

const privateRouteTable = new aws.ec2.RouteTable(prviateRoute, {
    vpcId: vpc.id,
    tags:{
        Name:prviateRoute,
    },
});

const defaultRoute = new aws.ec2.Route("defaultRoute", {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: destinationCidrBlockconfig,
    gatewayId: internetGateway.id,
});

randomAZs.apply(azList => {
    for (let i = 0; i < azList.length; i++) {
        const publicSubnet = publicSubnets[i];
        const privateSubnet = privateSubnets[i];

        new aws.ec2.RouteTableAssociation(`publicRouteTableAssociation-${azList[i]}`, {
            subnetId: publicSubnet.id,
            routeTableId: publicRouteTable.id,
        });

        new aws.ec2.RouteTableAssociation(`privateRouteTableAssociation-${azList[i]}`, {
            subnetId: privateSubnet.id,
            routeTableId: privateRouteTable.id,
        });
    }
});


// ?changed new db name÷ ÷