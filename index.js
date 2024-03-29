import dotenv from "dotenv"
dotenv.config()
import axios from 'axios'
let baseUrl = `http://${process.env.PRIVATE_SERVER_ADDRESS}`
let userId, token;
let users = {};
let userScores;
let teams = {
		'A':['Gadjung', 'Dakryolith', 'Kalgen', 'CaptainMuscles',
				'Saruss', 'admon', 'GT500', 'DroidFreak','slowmotionghost','MarvinTMB'],
		'B':[
				'Robalian',
				'asdpof',
				'harabi',
				'MadDokMike',
				'Mirroar',
				'Modus',
				'Nightdragon',
				'SBense',
				'Trepidimous',
				'Yoner'
		]
}
let sectors = [[5,5],[15,15],[25,25]]
async function getToken(){
		if (process.env.PRIVATE_SERVER_ADDRESS && process.env.PRIVATE_USER && process.env.PRIVATE_PASSWORD){
				//using local server - first need to get the token(normally generated from screeps site but cant do this for pserver)
				//server must have authmod installed
				//go to http://yourServerHostOrIP:21025/authmod/password/
				//get token by sending user and password (set up using authmod), once got token can use this to subscribe to socket as if normal server
				let url = `http://${process.env.PRIVATE_SERVER_ADDRESS}/api/auth/signin`
				//find user by listing users using the storage option in the pserver cli, then you want _id
				let ret = await axios.post(url, {
						'email':process.env.PRIVATE_USER,
						'password': process.env.PRIVATE_PASSWORD
				}).then(res => {
						if (res){
								console.log('token found')
								token = res.data.token
						}
				})
				.catch(error => {
						console.error(error)
				})
		}
}
async function getUserId(){
		let url = `${baseUrl}/api/auth/me`
		await axios.get(url,
				{headers:{
								'X-Token': token,
								'X-Username': process.env.PRIVATE_USER
						}}
		).then((res)=> {
						if (res.data && res.data._id){
								userId = res.data._id
						}
				}
		)
}
main()
async function processRoom(roomName){
		let RCL = await getLevel(roomName)
		if (RCL){
				let userID = await processRoomObjects(roomName)
				if (userID){
						let username = userID
						if (users[userID]){
								username = users[userID].name;
								users[userID].score += RCL
						}
						console.log('room counted for',username,': level',RCL)
				} else {
						console.log('no spawns in',roomName)
				}
		}
}
async function getRooms(E,N){
		let promises = []
		for (let x = E-4; x < E+5;x++){
				for (let y = N-4; y < N+5;y++){
						let roomName = `E${x}N${y}`
						promises.push(processRoom(roomName))
				}
		}
		await Promise.all(promises)
}
async function processSectors(){
		for (let i in sectors){
				await getRooms(sectors[i][0],sectors[i][1])
		}
}
async function getLevel(roomName){
		let url = `${baseUrl}/api/game/map-stats`
		let level = 0
		try {
				await axios.post(url,
						{
								rooms:[roomName],
								statName:'owner0'
						}
						,
						{headers:{
										'X-Token': token,
										'X-Username': process.env.PRIVATE_USER
								}}
				).then((res)=> {
						console.log(JSON.stringify(res.data))
								if (res.data && res.data.stats && res.data.stats[roomName] && res.data.stats[roomName].own
										&& res.data.stats[roomName].own.level){
										level = res.data.stats[roomName].own.level
								}
								if (res.data && res.data.users){
										for (let i in res.data.users){
												let obj = res.data.users[i]
												if (obj._id && !users[obj._id]){
														users[obj._id] = {name:obj.username,score:0};
												}
										}
								}
						}
				)
		} catch {
				console.log(roomName,'failed')
		}

		return level
}
async function processRoomObjects(roomName){
		let url = `${baseUrl}/api/game/room-objects?room=${roomName}`
		let controllerUser;
		let spawns = []
		await axios.get(url,
				{headers:{
								'X-Token': token,
								'X-Username': process.env.PRIVATE_USER
						}}
		).then((res)=> {
						if (res.data && res.data.objects){
								for (let i in res.data.objects){
										let type = res.data.objects[i].type
										if (type === 'controller'){
												controllerUser = res.data.objects[i].user;
										} else if (type === 'spawn'){
												spawns.push(res.data.objects[i].user)
										}
								}
						}
				}
		)
		if (spawns && spawns.length > 0 && controllerUser && spawns.includes(controllerUser)){
				return controllerUser
		}
}
async function main(){
		await getToken()
		await getUserId()
		await processSectors()
		console.log(JSON.stringify(users))
		let list = []
		for (let i in users){
				let userObj = users[i]
				if (userObj && userObj.score){
						list.push(i)
				}
		}
		list.sort((a,b)=>users[b].score - users[a].score)
		let teamScores = {}
		for (let i in list){
				let team;
				for (let t in teams){
						if (teams[t].includes(users[list[i]].name)){
								team = t
								if (!teamScores[t]){
										teamScores[t] = 0
								}
								teamScores[t] += users[list[i]].score
								break
						}
				}
				console.log(users[list[i]].name, users[list[i]].score,team)
		}
		for (let i in teamScores){
				console.log(i,teamScores[i])
		}
}